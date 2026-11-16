import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
export function GalleryImages() {
  return (
    <>
      {[1, 2, 3, 4].map((i) => (
        <a key={i} href={`upload/${i}.jpg`}>
          <img
            src={`images/optimized/${i}-550.jpg`}
            width={550}
            height={500}
            alt={`Smoky Mountain Cup tournament photograph ${i}`}
            loading="lazy"
            decoding="async"
          />
        </a>
      ))}
    </>
  );
}
export function InquiryForm({
  kind,
  children,
}: {
  kind: 'contact' | 'registration' | 'vendor';
  children: ReactNode;
}) {
  const [csrf, setCsrf] = useState('');
  useEffect(() => {
    const c = new AbortController();
    fetch('/api/v1/auth/csrf', { signal: c.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setCsrf(d.token))
      .catch(() => {});
    return () => c.abort();
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const button = form.querySelector('button');
    if (button) button.disabled = true;
    try {
      let token = csrf;
      if (!token) {
        const response = await fetch('/api/v1/auth/csrf');
        if (!response.ok) throw Error();
        token = (await response.json()).token;
      }
      const fields = Object.fromEntries(new FormData(form));
      const r = await fetch('/api/v1/public/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
        body: JSON.stringify({ kind, ...fields }),
      });
      if (!r.ok) {
        const d = await r.json();
        sessionStorage.setItem(
          'cup-form-error',
          typeof d.message === 'string'
            ? d.message
            : 'Your message could not be sent. Please try again later.',
        );
        location.assign('/message-error');
        return;
      }
      location.assign('/thank-you.php');
    } catch {
      sessionStorage.setItem(
        'cup-form-error',
        'Your message could not be sent. Please contact smokymountaincup@yahoo.com or try again later.',
      );
      location.assign('/message-error');
    } finally {
      if (button) button.disabled = false;
    }
  }
  return (
    <form
      action={
        kind === 'registration'
          ? 'inscriptionmail.php'
          : kind === 'vendor'
            ? 'sellermail.php'
            : 'mail.php'
      }
      method="post"
      onSubmit={submit}
    >
      <input type="hidden" name="csrf" value={csrf} />
      {children}
    </form>
  );
}
export function MessageError() {
  return (
    <main id="main-content" className="cup-section">
      <h1>Message not sent</h1>
      <p>
        {sessionStorage.getItem('cup-form-error') ||
          'Your message could not be sent. Please try again later.'}
      </p>
      <a href="contact.php">Return to contact</a>
    </main>
  );
}
