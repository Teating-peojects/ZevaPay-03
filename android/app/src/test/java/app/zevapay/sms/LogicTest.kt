package app.zevapay.sms

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SenderFilterTest {
    private val received =
        "You have received Tk 3,000.00 from 01608576689. Ref ajaj. Fee Tk 0.00. TrxID DK3508MJ4R at 03/11/2026 18:09"

    @Test fun acceptsTheFourSenders() {
        assertEquals(Provider.BKASH, SenderFilter.shouldForward("bKash", received))
        assertEquals(Provider.NAGAD, SenderFilter.shouldForward("NAGAD", received))
        assertEquals(Provider.ROCKET, SenderFilter.shouldForward("16216", received))
        assertEquals(Provider.UPAY, SenderFilter.shouldForward("upay", received))
    }

    @Test fun ignoresCaseAndSpaces() {
        assertEquals(Provider.BKASH, SenderFilter.shouldForward(" BKASH ", received))
        assertEquals(Provider.UPAY, SenderFilter.shouldForward("UPAY", received))
    }

    @Test fun matchesTheSenderExactly() {
        assertNull(SenderFilter.shouldForward("bKash-Offers", received))
        assertNull(SenderFilter.shouldForward("MyBkash", received))
        assertNull(SenderFilter.shouldForward("+8801712345678", received))
        assertNull(SenderFilter.shouldForward("162160", received))
        assertNull(SenderFilter.shouldForward("+16216", received))
        assertNull(SenderFilter.shouldForward("Grameenphone", received))
        assertNull(SenderFilter.shouldForward(null, received))
        assertNull(SenderFilter.shouldForward("", received))
    }

    @Test fun dropsEmptyMessages() {
        assertNull(SenderFilter.shouldForward("bKash", ""))
        assertNull(SenderFilter.shouldForward("bKash", "   "))
        assertNull(SenderFilter.shouldForward("bKash", null))
    }

    @Test fun dropsPinAndOneTimeCodeMessages() {
        assertNull(SenderFilter.shouldForward("bKash", "Your bKash verification code is 482910. Do not share."))
        assertNull(SenderFilter.shouldForward("NAGAD", "Your OTP is 123456"))
        assertNull(SenderFilter.shouldForward("16216", "Use PIN 4321 to confirm"))
    }

    @Test fun keepsAPaymentMessageThatMentionsAPin() {
        val text = "Received Tk 500. TrxID ABC123XYZ. Never share your PIN."
        assertEquals(Provider.BKASH, SenderFilter.shouldForward("bKash", text))
    }
}

class UrlRulesTest {
    @Test fun httpsOnlyInRelease() {
        assertEquals("https://pay.example.com", UrlRules.normalize("https://pay.example.com/", false))
        assertNull(UrlRules.normalize("http://pay.example.com", false))
        assertEquals("http://192.168.0.5:4000", UrlRules.normalize("http://192.168.0.5:4000", true))
    }

    @Test fun refusesJunk() {
        assertNull(UrlRules.normalize("", false))
        assertNull(UrlRules.normalize("pay.example.com", false))
        assertNull(UrlRules.normalize("https://user:pw@pay.example.com", false))
        assertNull(UrlRules.normalize("https://", false))
        assertNull(UrlRules.normalize("ftp://pay.example.com", true))
    }
}

class OutcomeTest {
    private fun json(text: String) = JSONObject(text)

    @Test fun matchedOnlyWhenTheServerSaysSo() {
        assertEquals(Outcome.MATCHED, outcomeOf(json("""{"duplicate":false,"autoAccepted":true,"status":"CONFIRMED"}""")))
        assertEquals(Outcome.WAITING, outcomeOf(json("""{"duplicate":false,"autoAccepted":false,"status":"PENDING"}""")))
    }

    @Test fun reviewAndDuplicate() {
        assertEquals(Outcome.REVIEW, outcomeOf(json("""{"autoAccepted":false,"status":"REVIEW"}""")))
        assertEquals(Outcome.DUPLICATE, outcomeOf(json("""{"duplicate":true,"status":"PENDING"}""")))
    }

    @Test fun aMissingAnswerIsNeverMatched() {
        assertEquals(Outcome.WAITING, outcomeOf(json("{}")))
    }
}

class ClassifyTest {
    @Test fun mapsStatusesToActions() {
        assertTrue(classify(201, JSONObject("""{"a":1}""")) is ApiResult.Ok)
        assertEquals(ApiResult.Unauthorized, classify(401, null))
        assertTrue(classify(429, null) is ApiResult.Retry)
        assertTrue(classify(503, null) is ApiResult.Retry)
    }

    @Test fun otherClientErrorsAreFinalAndCarryTheServerMessage() {
        val result = classify(400, JSONObject("""{"error":{"code":"BAD_REQUEST","message":"That pairing code has expired."}}"""))
        assertEquals(ApiResult.Rejected("That pairing code has expired."), result)
        assertEquals(ApiResult.Rejected("The server answered 422."), classify(422, null))
    }
}
