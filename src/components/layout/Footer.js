import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-content">
        <section className="footer-section">
          <h3>About GameHub</h3>
          <p>
            A collection of fun and interactive games built with modern web technologies.
            Each game is carefully crafted to provide an engaging experience.
            Have fun! 😸
          </p>
        </section>

        <section className="footer-section">
          <h3>Legal</h3>
          <ul>
            <li><Link to="/terms">Terms & Conditions</Link></li>
            <li><a href="https://github.com/DanyilT/WebDev/" target="_blank" rel="noopener noreferrer">Repo of This</a></li>
          </ul>
        </section>

        <section className="footer-section">
          <h3>Social</h3>
          <ul>
            <li><a href="https://github.com/DanyilT" target="_blank" rel="noopener noreferrer">GitHub</a></li>
            <li><a href="https://instagram.com/dany_tymchuk" target="_blank" rel="noopener noreferrer">Instagram</a></li>
          </ul>
        </section>
      </div>

      <div className="footer-bottom">
        <p><strong>&copy; {new Date().getFullYear()} <b>Dany</b>.</strong> All rights reserved.</p>
      </div>
    </footer>
  );
};

export default Footer;
