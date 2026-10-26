import type { Metadata } from 'next';
import { LegalPage, type LegalSection } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'The terms that govern access to and use of the orgwise Enterprise Workforce Intelligence Platform.',
};

const sections: LegalSection[] = [
  {
    heading: 'Acceptance of Terms',
    body: [
      'By accessing or using the orgwise platform, you agree to these Terms of Service and our Privacy Policy. If you are using the platform on behalf of an organization, you represent that you have authority to bind that organization.',
    ],
  },
  {
    heading: 'Use of the Service',
    body: [
      'The platform is provided to help organizations monitor workforce health, performance, structure, and insights. You agree to use the service lawfully and only for its intended purpose.',
      'Access credentials are personal and must not be shared. You are responsible for maintaining the confidentiality of your account and for all activity under it.',
    ],
  },
  {
    heading: 'Enterprise Data & Security',
    body: [
      'Data uploaded or connected to the platform remains your property. orgwise processes it solely to provide the service and in accordance with the applicable Data Processing Addendum.',
      'We implement appropriate technical and organizational security measures and will notify you of any unauthorized access as required by law.',
    ],
  },
  {
    heading: 'Acceptable Use',
    body: [
      'You must not misuse the platform — including attempting to breach security controls, reverse engineer the service, upload unlawful content, or use workforce data in a manner that discriminates or otherwise violates applicable law.',
    ],
  },
  {
    heading: 'Intellectual Property',
    body: [
      'orgwise retains all rights in the platform, including its software, design, and brand. Subject to these terms, we grant you a limited, non-exclusive, non-transferable right to use the service.',
    ],
  },
  {
    heading: 'Limitation of Liability',
    body: [
      'To the maximum extent permitted by law, orgwise shall not be liable for indirect, incidental, or consequential damages. Our aggregate liability under these terms is limited to the fees paid for the service in the twelve months preceding the claim.',
    ],
  },
  {
    heading: 'Changes & Contact',
    body: [
      'We may update these terms from time to time. Material changes will be communicated through the platform or by email. Continued use after changes constitutes acceptance.',
      'Questions may be directed to legal@orgwise.com.',
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="August 8, 2026"
      intro="These Terms of Service (“Terms”) govern your access to and use of the orgwise Enterprise Workforce Intelligence Platform, its website, and related services."
      sections={sections}
    />
  );
}
