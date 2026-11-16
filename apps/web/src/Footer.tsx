export function Footer() {
  return (
    <footer className="cup-footer">
      <div className="cup-footer-inner">
        <div>
          <strong>SMOKY MOUNTAIN CUP</strong>
          <span>Tennessee · Soccer, community and competition.</span>
        </div>
        <nav aria-label="Footer">
          <a href="tournament.php">Tournament & archive</a>
          <a href="contact.php">Contact</a>
          <a
            href="https://www.facebook.com/Smokymountaincup"
            rel="noopener noreferrer"
          >
            Facebook
          </a>
          <a href="admin/">Staff access</a>
        </nav>
        <span>{'© ' + new Date().getFullYear() + ' Smoky Mountain Cup'}</span>
      </div>
    </footer>
  );
}
