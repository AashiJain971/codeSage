'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import './Navbar.css';

interface NavbarProps {
  theme?: 'light' | 'dark';
}

const Navbar = ({ theme = 'light' }: NavbarProps) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

    const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/interview', label: 'Take Interview' },
    { href: '/past-interviews', label: 'Past Interviews' }
  ];

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <nav className={`navbar ${isScrolled ? 'navbar-scrolled' : ''} ${theme === 'dark' ? 'navbar-dark' : 'navbar-light'}`}>
      <div className="container">
        <div className="navbar-content">
          <div className="navbar-brand">
            <Link href="/" className="brand-link">
              <span className="brand-text">{"</> "}CodeSage</span>
            </Link>
          </div>
          
          <div className={`navbar-links ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
            {navLinks.map((link, index) => (
              <Link 
                key={index} 
                href={link.href} 
                className={`nav-link ${isActive(link.href) ? 'nav-link-active' : ''}`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="navbar-mobile">
            <button 
              className={`mobile-menu-btn ${isMobileMenuOpen ? 'active' : ''}`}
              onClick={toggleMobileMenu}
              aria-label="Toggle mobile menu"
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
