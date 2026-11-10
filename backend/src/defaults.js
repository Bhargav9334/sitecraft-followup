// Default 6-email sequence. Everything here is editable from the Sequence page,
// and "Restore default emails" there brings this text back.
//
// delayDays = days to wait after the PREVIOUS email.
// Empty subject on a follow-up = it is sent as "Re: <first subject>" in the same thread.
// The signature (Best regards / SiteCraft by Bhargav / phone) and the unsubscribe
// link are added automatically under every email — do not type them here.

const DEFAULT_STEPS = [
  {
    delayDays: 0,
    subject: 'A quick question about {{company|your website}}',
    body: `Hi {{first_name|there}},

I'm {{sender_name}} from SiteCraft. We build websites and custom software for small and growing businesses.

I came across {{company|your business}} and wanted to ask: is your website bringing you new customers, or is it something you've been meaning to improve?

Here is what we focus on:

- Fast delivery: a clear timeline agreed upfront, and we stick to it
- Reliable work: mobile-friendly websites that load quickly and are easy to update
- Fair pricing: affordable packages with no hidden charges

If it would be useful, I can share a few ideas for {{company|your business}} along with a rough quote. Would you be open to a quick chat?`,
  },
  {
    delayDays: 3,
    subject: '',
    body: `Hi {{first_name|there}},

Just bringing my last email back to the top of your inbox.

Small fixes often make a real difference: one clear contact number, an enquiry form that works, and showing up properly on Google. Most businesses start getting more calls within a few weeks.

I'd be happy to show you exactly what I would change for {{company|your business}}. Should I send over a short plan?`,
  },
  {
    delayDays: 5,
    subject: '',
    body: `Hi {{first_name|there}},

To give you a clearer picture, this is what a website from us usually includes:

- Your own domain and a professional business email
- A mobile-friendly design that loads fast
- Enquiry or booking forms that send new leads straight to your WhatsApp
- Setup on Google Maps so local customers can find you
- Help with changes and updates after launch

If you like, I can put together a one-page sample for {{company|your business}}, so you can see it before deciding anything.`,
  },
  {
    delayDays: 7,
    subject: '',
    body: `Hi {{first_name|there}},

Many business owners tell me they've had a bad experience with a web developer before: delays, extra charges, or someone who stopped replying after launch.

Here is how we work instead:

1. A 10-minute call to understand your business
2. A fixed price and timeline in writing before any work starts
3. A preview you can check and change before it goes live
4. Support on WhatsApp after launch

Would a short call this week or next suit you?`,
  },
  {
    delayDays: 10,
    subject: '',
    body: `Hi {{first_name|there}},

I'll keep this one short. Is a better website something you'd want for {{company|your business}}?

You can simply reply with a number:

1 - Yes, let's talk
2 - Maybe later, check back in a few months
3 - Not interested

Any answer helps, and I'll go with it.`,
  },
  {
    delayDays: 14,
    subject: '',
    body: `Hi {{first_name|there}},

I haven't heard back, so I'll take it that now isn't the right time. This will be my last email.

If you ever want a new website, a redesign or simple software for {{company|your business}}, just reply to this email, even months from now, and I'll pick it up from there.

Wishing you and your team all the best.`,
  },
];

const STEP_COUNT = 6;

module.exports = { DEFAULT_STEPS, STEP_COUNT };
