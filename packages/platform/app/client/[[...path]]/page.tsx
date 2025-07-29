/**
 * Client Application Page
 * Serves the ElizaOS client GUI
 */

import { Metadata } from 'next';
import ClientApp from './ClientApp';

export const metadata: Metadata = {
  title: 'ElizaOS Client',
  description: 'ElizaOS Client Interface for Agent Management',
};

export default function ClientPage() {
  return <ClientApp />;
}
