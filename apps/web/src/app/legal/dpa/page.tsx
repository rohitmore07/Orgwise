import type { Metadata } from 'next';
import { LegalPage, type LegalSection } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Data Processing Addendum',
  description:
    'The orgwise Data Processing Addendum governing how personal data is processed for enterprise customers.',
};

const sections: LegalSection[] = [
  {
    heading: 'Definitions & Scope',
    body: [
      'This Data Processing Addendum (“DPA”) forms part of the agreement between the customer and orgwise, Inc. (“Processor”). It governs the processing of personal data in connection with the provision of the orgwise platform.',
      'Terms such as “personal data”, “processing”, “data subject”, and “controller” have the meanings given in applicable data protection law, including the GDPR and CCPA as relevant.',
    ],
  },
  {
    heading: 'Processing of Personal Data',
    body: [
      'The Processor processes personal data solely on the documented instructions of the customer, and only for the purposes described in the agreement — namely, delivering workforce intelligence, analytics, and related support.',
      'The Processor shall not retain, use, or disclose personal data for any purpose other than those permitted, and shall not “sell” or “share” personal data as those terms are defined under applicable law.',
    ],
  },
  {
    heading: 'Subprocessors',
    body: [
      'The Processor may engage subprocessors to assist in providing the service, provided each is bound by data protection obligations equivalent to those in this DPA.',
      'A current list of subprocessors is maintained and made available to customers, with advance notice of any material changes and the right to object.',
    ],
  },
  {
    heading: 'Data Subject Rights',
    body: [
      'The Processor will reasonably assist the customer in fulfilling its obligations to respond to data subject requests — including access, rectification, erasure, restriction, portability, and objection — using appropriate technical and organizational measures.',
    ],
  },
  {
    heading: 'Security Measures',
    body: [
      'The Processor implements and maintains appropriate technical and organizational measures to ensure a level of security appropriate to the risk, including encryption in transit and at rest, access controls, and regular security testing.',
      'Security incidents will be notified to the customer without undue delay, together with such information as is available to assist in any required notification.',
    ],
  },
  {
    heading: 'International Transfers & Termination',
    body: [
      'Where personal data is transferred outside the EEA or UK, the Processor relies on appropriate safeguards, including standard contractual clauses, unless another lawful basis applies.',
      'Upon termination of the agreement, the Processor shall, at the customer’s option, delete or return all personal data, unless retention is required by law. This DPA survives termination until all data is deleted or returned.',
    ],
  },
];

export default function DpaPage() {
  return (
    <LegalPage
      eyebrow="Legal · DPA"
      title="Data Processing Addendum"
      updated="August 8, 2026"
      intro="This Data Processing Addendum sets out the terms on which orgwise, Inc. processes personal data on behalf of enterprise customers of the orgwise platform, in accordance with applicable data protection law."
      sections={sections}
    />
  );
}
