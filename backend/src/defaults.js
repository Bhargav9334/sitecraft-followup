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

Just following up on my previous email.

If a new website, or an update to your current one, is on your list this year, I'd be glad to help. Reply with a line about what you have in mind and I'll send you a clear quote.`,
  },
  {
    delayDays: 7,
    subject: '',
    body: `Hi {{first_name|there}},

In case it helps, here is what we usually build for businesses like {{company|yours}}:

- Business websites that look great on mobile and load fast
- Online booking and enquiry forms that send new leads straight to you
- Simple custom software for billing, customer records and day-to-day work

Every project is planned around your budget, and we stay available for changes and support after launch.

Is any of this something you have been thinking about?`,
  },
  {
    delayDays: 7,
    subject: '',
    body: `Hi {{first_name|there}},

A common worry with website projects is delays and unexpected costs. Here is how we keep it simple:

1. A short call to understand what you need
2. A fixed quote and timeline before any work starts
3. Regular updates until your website is live

No long contracts and no hidden charges.

Would a 10-minute call this week work for you?`,
  },
  {
    delayDays: 10,
    subject: '',
    body: `Hi {{first_name|there}},

I don't want to fill up your inbox, so I'll keep this short.

If {{company|your business}} needs a new website, a redesign, or software to save time on daily work, just reply with a line about it and I'll get back to you with a clear quote.`,
  },
  {
    delayDays: 15,
    subject: '',
    body: `Hi {{first_name|there}},

I haven't heard back, so I'll assume the timing isn't right and I won't email you again.

If you ever need a website or custom software for {{company|your business}}, just reply to this email and I'll be happy to help.

Thank you for your time.`,
  },
];

const STEP_COUNT = 6;

module.exports = { DEFAULT_STEPS, STEP_COUNT };
