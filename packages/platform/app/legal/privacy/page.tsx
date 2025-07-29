'use client';

import { ArrowLeftIcon } from '@radix-ui/react-icons';
import { useRouter } from 'next/navigation';

export default function PrivacyPolicy() {
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
          <h1 className="text-3xl font-bold">Privacy Policy</h1>
          <p className="mt-2 text-gray-600">Last updated: December 25, 2024</p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="prose prose-gray max-w-none">
          <h2>1. Information We Collect</h2>
          <p>
            We collect information you provide directly to us, such as when you
            create an account, use our services, or contact us for support.
          </p>

          <h3>Account Information</h3>
          <ul>
            <li>Email address and name</li>
            <li>Organization details</li>
            <li>Billing and payment information</li>
            <li>Profile picture (optional)</li>
          </ul>

          <h3>Usage Information</h3>
          <ul>
            <li>Agent configurations and data</li>
            <li>API usage logs and metrics</li>
            <li>Service interaction data</li>
            <li>Error logs and diagnostics</li>
          </ul>

          <h3>Technical Information</h3>
          <ul>
            <li>IP address and device information</li>
            <li>Browser type and version</li>
            <li>Access times and duration</li>
            <li>Cookies and session data</li>
          </ul>

          <h2>2. How We Use Your Information</h2>
          <p>We use the information we collect to:</p>
          <ul>
            <li>Provide, maintain, and improve our services</li>
            <li>Process transactions and send billing information</li>
            <li>Send technical notices and support messages</li>
            <li>Monitor and analyze usage patterns</li>
            <li>Detect and prevent fraud and abuse</li>
            <li>Comply with legal obligations</li>
          </ul>

          <h2>3. Information Sharing</h2>
          <p>
            We do not sell, trade, or otherwise transfer your personal
            information to third parties except as described in this policy:
          </p>

          <h3>Service Providers</h3>
          <p>
            We may share information with trusted service providers who assist
            us in operating our platform, including payment processors, cloud
            infrastructure providers, and analytics services.
          </p>

          <h3>Legal Requirements</h3>
          <p>
            We may disclose information if required by law, court order, or
            government request, or to protect our rights and safety.
          </p>

          <h3>Business Transfers</h3>
          <p>
            In the event of a merger, acquisition, or sale of assets, your
            information may be transferred as part of the transaction.
          </p>

          <h2>4. Data Security</h2>
          <p>
            We implement appropriate security measures to protect your
            information against unauthorized access, alteration, disclosure, or
            destruction:
          </p>
          <ul>
            <li>Encryption in transit and at rest</li>
            <li>Access controls and authentication</li>
            <li>Regular security audits and monitoring</li>
            <li>SOC 2 Type II compliance</li>
          </ul>

          <h2>5. Data Retention</h2>
          <p>
            We retain your information for as long as necessary to provide our
            services and comply with legal obligations. You may request deletion
            of your account and associated data at any time.
          </p>

          <h2>6. Your Rights</h2>
          <p>Depending on your location, you may have the right to:</p>
          <ul>
            <li>Access your personal information</li>
            <li>Correct inaccurate information</li>
            <li>Delete your information</li>
            <li>Object to processing</li>
            <li>Data portability</li>
            <li>Withdraw consent</li>
          </ul>

          <h2>7. Cookies and Analytics</h2>
          <p>
            We use cookies and similar technologies to improve your experience
            and analyze service usage. You can control cookie settings through
            your browser preferences.
          </p>

          <h2>8. International Transfers</h2>
          <p>
            Your information may be processed and stored in countries other than
            your own. We ensure appropriate safeguards are in place for
            international data transfers.
          </p>

          <h2>9. Children's Privacy</h2>
          <p>
            Our services are not intended for children under 13. We do not
            knowingly collect personal information from children under 13.
          </p>

          <h2>10. Changes to This Policy</h2>
          <p>
            We may update this privacy policy from time to time. We will notify
            you of any material changes by email or through our platform.
          </p>

          <h2>11. Contact Us</h2>
          <p>
            If you have any questions about this privacy policy or our data
            practices, please contact us at:
          </p>
          <ul>
            <li>Email: privacy@elizaos.ai</li>
            <li>Address: ElizaOS Platform, Privacy Officer</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
