import type { Metadata } from 'next';
import { LegalPage, type LegalSection } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How orgwise collects, uses, and protects personal data across the Enterprise Workforce Intelligence Platform.',
};

const sections: LegalSection[] = [
  {
    heading: 'Information We Collect',
    body: [
      'orgwise collects data that organizations provide through connected HRIS, ATS, performance, and engagement systems, alongside account information (such as names, work email addresses, and roles) required to operate the platform.',
      'We may also collect limited usage data — such as feature interactions and anonymized diagnostic signals — to operate, secure, and improve the service.',
    ],
  },
  {
    heading: 'How We Use Data',
    body: [
      'Data is processed to deliver workforce intelligence, including health scores, attrition predictions, organizational mapping, and executive-ready reporting. We process data strictly under our customers’ instructions and applicable law.',
      'We do not sell personal data. We do not use workforce data to build consumer profiles or for unrelated advertising.',
    ],
  },
  {
    heading: 'Data Sharing & Processing',
    body: [
      'orgwise shares data only with subprocessors that are contractually bound to safeguard it — for example, cloud infrastructure and security services — and only to the extent needed to deliver the platform.',
      'A current list of subprocessors is available on request to enterprise customers.',
    ],
  },
  {
    heading: 'Retention & Security',
    body: [
      'We retain data only for as long as required to provide the service and meet legal obligations. Customers may request deletion in accordance with their subscription terms.',
      'Technical and organizational measures — including encryption in transit and at rest, access controls, and continuous monitoring — protect data against unauthorized access or loss.',
    ],
  },
  {
    heading: 'Your Rights',
    body: [
      'Depending on your jurisdiction, you may have rights to access, correct, export, or delete your personal data, and to object to certain processing. Contact your organization’s orgwise administrator in the first instance.',
      'You may also contact us directly at privacy@orgwise.com, and we will respond within applicable statutory timeframes.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="August 8, 2026"
      intro="orgwise, Inc. (“orgwise”, “we”, “us”) operates the orgwise Enterprise Workforce Intelligence Platform. This policy explains how we handle personal data when organizations and individuals use our services."
      sections={sections}
    />
  );
}
