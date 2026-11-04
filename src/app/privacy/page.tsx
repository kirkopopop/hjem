export const metadata = { title: "Privacy · hjem" };

export default function PrivacyPage() {
  return (
    <main className="auth-wrap" style={{ justifyContent: "flex-start", maxWidth: 680 }}>
      <span className="logo" style={{ marginBottom: 20 }}>
        hjem<span className="logo-dot">.</span>
      </span>
      <article className="card stack" style={{ lineHeight: 1.55 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>Privacy policy</h1>
        <p className="small" style={{ margin: 0 }}>Last updated: 4 November 2026</p>
        <p style={{ margin: 0 }}>
          hjem is a private household app used by one family. It is not offered to the public.
        </p>
        <h2 style={{ fontSize: 18 }}>What we store</h2>
        <p style={{ margin: 0 }}>
          Your name, email address and the tasks, meals, grocery items and badges you create. If you connect Google Calendar,
          we store the list of your calendars and copies of their events for the next few months so they can be shown in the
          app, plus the access token Google provides.
        </p>
        <h2 style={{ fontSize: 18 }}>How Google data is used</h2>
        <p style={{ margin: 0 }}>
          Calendar data is read only to show your events to members of your own household, and is written only when you add an
          event from the app. It is never sold, shared with anyone outside your household, used for advertising, or used to
          train AI models. hjem&apos;s use of information received from Google APIs adheres to the Google API Services User
          Data Policy, including the Limited Use requirements.
        </p>
        <h2 style={{ fontSize: 18 }}>Where it lives</h2>
        <p style={{ margin: 0 }}>
          Data is stored with Supabase (EU, Stockholm) and the app is served by Vercel. Access tokens are kept in a table the
          app itself cannot read; only the server-side sync function uses them.
        </p>
        <h2 style={{ fontSize: 18 }}>Removing your data</h2>
        <p style={{ margin: 0 }}>
          Disconnect Google Calendar in Household settings to delete your calendars, events and tokens and revoke access. You
          can also revoke access at any time at myaccount.google.com/permissions. To delete your account entirely, contact the
          household owner.
        </p>
      </article>
    </main>
  );
}
