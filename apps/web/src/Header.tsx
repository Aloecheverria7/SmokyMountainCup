import { useState } from 'react';
export function Header() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <a className="cup-skip" href="#main-content">
        Skip to content
      </a>
      <header className="cup-header">
        <div className="cup-header-inner">
          <a href="index.php" className="cup-brand">
            <img
              src="upload/logo.png"
              width={68}
              height={65}
              alt="Smoky Mountain Cup"
            />
            <span>
              SMOKY MOUNTAIN CUP<small>TENNESSEE · SOCCER</small>
            </span>
          </a>
          <button
            className="cup-menu-toggle"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls="cup-main-nav"
          >
            Menu
          </button>
          <nav
            id="cup-main-nav"
            className={open ? 'cup-nav is-open' : 'cup-nav'}
            aria-label="Main navigation"
          >
            <a href="index.php">Home</a>
            <a href="tournament.php">Tournament</a>
            <a href="tournament.php?view=fixtures">Fixtures & results</a>
            <a href="about.php">About</a>
            <a href="gallery.php">Gallery</a>
            <a href="contact.php">Contact</a>
          </nav>
        </div>
      </header>
    </>
  );
}
