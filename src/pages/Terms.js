import React from 'react';
import './Terms.css';

const Terms = () => {
  return (
    <div className="terms-page">
      <div className="terms-container">
        <h1>Terms & Conditions</h1>

        <section className="terms-section">
          <h2>1. Introduction</h2>
          <p>Welcome to GameHub. These terms and conditions outline the rules and regulations for the use of our website.</p>
        </section>

        <section className="terms-section">
          <h2>2. Intellectual Property Rights</h2>
          <p>All content on this website, including but not limited to text, graphics, logos, and software, is the property of GameHub and is protected by copyright laws.</p>
        </section>

        <section className="terms-section">
          <h2>3. User Responsibilities</h2>
          <p>Users are responsible for maintaining the confidentiality of their account information and for all activities that occur under their account.</p>
        </section>

        <section className="terms-section">
          <h2>4. Limitation of Liability</h2>
          <p>GameHub shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the service.</p>
        </section>

        <section className="terms-section">
          <h2>5. Changes to Terms</h2>
          <p>We reserve the right to modify these terms at any time. We will notify users of any changes by updating the date at the bottom of these terms.</p>
        </section>

        <div className="terms-footer">
          <p>Last updated: {new Date().toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
};

export default Terms;
