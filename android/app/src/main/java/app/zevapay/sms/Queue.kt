package app.zevapay.sms

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

data class QueuedMessage(
    val id: Long,
    val provider: Provider,
    val sender: String,
    val body: String,
    val receivedAt: String,
    val state: String,
    val attempts: Int,
    val detail: String?,
)

/**
 * Every SMS is written here first and sent afterwards, so nothing is lost when
 * the network is down or the app is killed. Messages sent long ago are removed.
 */
class Queue(context: Context) : SQLiteOpenHelper(context.applicationContext, "queue.db", null, 1) {
    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """CREATE TABLE messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                provider TEXT NOT NULL,
                sender TEXT NOT NULL,
                body TEXT NOT NULL,
                received_at TEXT NOT NULL,
                state TEXT NOT NULL,
                attempts INTEGER NOT NULL DEFAULT 0,
                detail TEXT,
                updated_at INTEGER NOT NULL
            )""",
        )
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit

    @Synchronized
    fun insert(provider: Provider, sender: String, body: String, receivedAt: String): Long {
        val now = System.currentTimeMillis()
        val values = ContentValues().apply {
            put("provider", provider.name)
            put("sender", sender)
            put("body", body)
            put("received_at", receivedAt)
            put("state", "PENDING")
            put("updated_at", now)
        }
        // Keep sent messages for a week only.
        writableDatabase.delete(
            "messages",
            "state = 'SENT' AND updated_at < ?",
            arrayOf((now - 7L * 86_400_000L).toString()),
        )
        return writableDatabase.insert("messages", null, values)
    }

    @Synchronized
    fun pending(limit: Int): List<QueuedMessage> = read("state = 'PENDING'", "id ASC", limit)

    @Synchronized
    fun recent(limit: Int): List<QueuedMessage> = read(null, "id DESC", limit)

    @Synchronized
    fun pendingCount(): Int =
        readableDatabase.rawQuery("SELECT COUNT(*) FROM messages WHERE state = 'PENDING'", null).use {
            if (it.moveToFirst()) it.getInt(0) else 0
        }

    @Synchronized
    fun markSent(id: Long, outcome: Outcome) = update(id, "SENT", outcome.label, bump = true)

    @Synchronized
    fun markFailed(id: Long, reason: String) = update(id, "FAILED", reason, bump = true)

    @Synchronized
    fun noteRetry(id: Long, reason: String) = update(id, "PENDING", reason, bump = true)

    private fun update(id: Long, state: String, detail: String, bump: Boolean) {
        writableDatabase.execSQL(
            "UPDATE messages SET state = ?, detail = ?, attempts = attempts + ?, updated_at = ? WHERE id = ?",
            arrayOf<Any>(state, detail, if (bump) 1 else 0, System.currentTimeMillis(), id),
        )
    }

    private fun read(where: String?, order: String, limit: Int): List<QueuedMessage> {
        val out = ArrayList<QueuedMessage>()
        readableDatabase.query(
            "messages",
            arrayOf("id", "provider", "sender", "body", "received_at", "state", "attempts", "detail"),
            where, null, null, null, order, limit.toString(),
        ).use { c ->
            while (c.moveToNext()) {
                out += QueuedMessage(
                    id = c.getLong(0),
                    provider = Provider.valueOf(c.getString(1)),
                    sender = c.getString(2),
                    body = c.getString(3),
                    receivedAt = c.getString(4),
                    state = c.getString(5),
                    attempts = c.getInt(6),
                    detail = c.getString(7),
                )
            }
        }
        return out
    }
}
