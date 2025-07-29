'use client';

import { ArrowLeftIcon } from '@radix-ui/react-icons';
import { useRouter } from 'next/navigation';

export default function TermsOfService() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-200">
        <div className="mx-auto max-w-4xl px-6 py-6">
          <button
            onClick={() => router.back()}
            className="mb-4 flex items-center space-x-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            <span>Back</span>
          </button>
          <h1 className="text-3xl font-bold">Terms of Service</h1>
          <p className="mt-2 text-gray-600">Last updated: December 25, 2024</p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="prose prose-gray max-w-none">
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using the ElizaOS Platform ("Service"), you agree to
            be bound by these Terms of Service ("Terms"). If you disagree with
            any part of these terms, you may not access the Service.
          </p>

          <h2>2. Description of Service</h2>
          <p>
            ElizaOS Platform is a hosted service that enables developers to
            build, deploy, and monetize AI agents using the ElizaOS framework.
            The Service includes:
          </p>
          <ul>
            <li>Agent development and configuration tools</li>
            <li>Hosted infrastructure and deployment</li>
            <li>Multi-provider AI model access</li>
            <li>Billing and payment processing</li>
            <li>Analytics and monitoring</li>
          </ul>

          <h2>3. User Accounts</h2>
          <h3>Account Creation</h3>
          <p>
            You must create an account to use our Service. You are responsible
            for maintaining the confidentiality of your account credentials and
            for all activities under your account.
          </p>

          <h3>Account Eligibility</h3>
          <p>
            You must be at least 18 years old and have the legal capacity to
            enter into contracts. If you are using the Service on behalf of an
            organization, you represent that you have authority to bind that
            organization.
          </p>

          <h3>Account Security</h3>
          <p>
            You agree to immediately notify us of any unauthorized use of your
            account. We are not liable for any loss resulting from unauthorized
            use of your credentials.
          </p>

          <h2>4. Acceptable Use</h2>
          <p>You agree not to use the Service to:</p>
          <ul>
            <li>Violate any applicable laws or regulations</li>
            <li>Infringe on intellectual property rights</li>
            <li>Transmit harmful, offensive, or illegal content</li>
            <li>Attempt to gain unauthorized access to our systems</li>
            <li>Interfere with or disrupt the Service</li>
            <li>Use the Service for competing commercial purposes</li>
            <li>Generate content that violates AI provider policies</li>
            <li>Create agents for illegal or harmful activities</li>
          </ul>

          <h2>5. Content and Intellectual Property</h2>
          <h3>Your Content</h3>
          <p>
            You retain ownership of all content you create, upload, or store
            using the Service. You grant us a limited license to host, store,
            and process your content to provide the Service.
          </p>

          <h3>Our Intellectual Property</h3>
          <p>
            The Service and all related technology, including the ElizaOS
            framework integration, are protected by intellectual property laws.
            You may not copy, modify, or reverse engineer our technology.
          </p>

          <h3>Third-Party Content</h3>
          <p>
            The Service may include content from third parties, including AI
            model providers. Such content is subject to the respective
            third-party terms and licenses.
          </p>

          <h2>6. Payment and Billing</h2>
          <h3>Fees</h3>
          <p>
            Our Service operates on a pay-as-you-go model. You will be charged
            for actual usage of AI models, storage, and premium features
            according to our published pricing.
          </p>

          <h3>Payment Terms</h3>
          <ul>
            <li>Automatic billing based on usage</li>
            <li>Credit system with auto top-up options</li>
            <li>Support for credit card and cryptocurrency payments</li>
            <li>Taxes may apply based on your location</li>
          </ul>

          <h3>Refunds</h3>
          <p>
            Refunds are generally not available for consumed services. We may
            provide refunds or credits at our discretion for service outages or
            billing errors.
          </p>

          <h2>7. Service Availability</h2>
          <h3>Uptime Commitment</h3>
          <p>
            We strive to maintain 99.9% uptime for our core services. Scheduled
            maintenance will be announced in advance when possible.
          </p>

          <h3>Service Changes</h3>
          <p>
            We may modify, suspend, or discontinue any part of the Service at
            any time. We will provide reasonable notice for material changes
            affecting your use.
          </p>

          <h2>8. Data and Privacy</h2>
          <p>
            Your privacy is important to us. Our collection and use of personal
            information is governed by our Privacy Policy, which is incorporated
            into these Terms by reference.
          </p>

          <h3>Data Security</h3>
          <p>
            We implement industry-standard security measures to protect your
            data. However, no method of transmission or storage is 100% secure.
          </p>

          <h3>Data Backup</h3>
          <p>
            While we perform regular backups, you are responsible for
            maintaining your own backups of critical data and configurations.
          </p>

          <h2>9. Limitation of Liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR
            ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE
            DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, OR USE.
          </p>

          <p>
            OUR TOTAL LIABILITY FOR ANY CLAIMS ARISING FROM OR RELATED TO THE
            SERVICE SHALL NOT EXCEED THE AMOUNT PAID BY YOU IN THE 12 MONTHS
            PRECEDING THE CLAIM.
          </p>

          <h2>10. Indemnification</h2>
          <p>
            You agree to indemnify and hold us harmless from any claims,
            damages, or expenses arising from your use of the Service, violation
            of these Terms, or infringement of any third-party rights.
          </p>

          <h2>11. Termination</h2>
          <h3>Termination by You</h3>
          <p>
            You may terminate your account at any time by contacting us or using
            the account deletion feature in your dashboard.
          </p>

          <h3>Termination by Us</h3>
          <p>
            We may suspend or terminate your account for violation of these
            Terms, non-payment, or for any reason with reasonable notice.
          </p>

          <h3>Effect of Termination</h3>
          <p>
            Upon termination, your access to the Service will cease, and we may
            delete your data after a reasonable grace period.
          </p>

          <h2>12. Governing Law</h2>
          <p>
            These Terms are governed by the laws of Delaware, United States,
            without regard to conflict of law principles. Any disputes will be
            resolved in the courts of Delaware.
          </p>

          <h2>13. Changes to Terms</h2>
          <p>
            We may modify these Terms at any time. Material changes will be
            communicated via email or platform notification. Continued use of
            the Service constitutes acceptance of the updated Terms.
          </p>

          <h2>14. Contact Information</h2>
          <p>For questions about these Terms, please contact us at:</p>
          <ul>
            <li>Email: legal@elizaos.ai</li>
            <li>Address: ElizaOS Platform, Legal Department</li>
          </ul>

          <h2>15. Severability</h2>
          <p>
            If any provision of these Terms is found to be unenforceable, the
            remaining provisions will continue to be valid and enforceable.
          </p>
        </div>
      </div>
    </div>
  );
}
