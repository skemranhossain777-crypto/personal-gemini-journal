import React from 'react';
import {
  Shield,
  Lock,
  Database,
  Cpu,
  Network,
  CheckCircle2,
  MapPin,
  Crown,
  Bell,
} from 'lucide-react';
import { Modal } from './Modal';

interface ThreatModelModalProps {
  isOpen: boolean;
  onClose: () => void;
  userUid?: string;
}

export const ThreatModelModal: React.FC<ThreatModelModalProps> = ({ isOpen, onClose, userUid }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Agentic Threat Modeling & Security Posture"
      description="8 Threat Zones mapped to production defenses and verification"
      icon={<Shield className="h-5 w-5" />}
      iconClassName="bg-emerald-950/60 border border-emerald-800/40 text-emerald-400"
      maxWidthClass="max-w-4xl"
      footer={
        <button
          onClick={onClose}
          className="rounded-xl border border-[#333338] bg-[#1A1A1C] px-4 py-2 text-xs font-medium text-[#F1F1F1] transition-colors hover:border-[#44444C] hover:bg-[#242428]"
        >
          Close Threat Model
        </button>
      }
    >
      <div className="space-y-6 p-6">
        {/* User isolation active path */}
        <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/20 p-4">
          <div className="mb-1 flex items-center gap-2 text-sm font-medium text-emerald-300">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            Active Database Isolation Path
          </div>
          <p className="break-all font-mono text-xs text-[#D5D5DB]">
            {userUid
              ? `/users/${userUid}/interactions/{interactionId}`
              : 'Unauthenticated (Requires Google Sign-In to generate user partition)'}
          </p>
          <p className="mt-2 text-xs text-[#888]">
            Protected by server-enforced Firestore Rules: only the authenticated owner whose UID matches the document path is permitted read and write access.
          </p>
        </div>

        {/* Threat Summary Table (8 Threat Zones) */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#888]">
            Threat Summary Table (8 Threat Zones)
          </h3>
          <div className="overflow-x-auto rounded-xl border border-[#262629]">
            <table className="w-full text-left text-xs text-[#A0A0A5]">
              <thead className="border-b border-[#262629] bg-[#161619] text-[#F1F1F1]">
                <tr>
                  <th className="p-3 font-semibold">Threat Zone</th>
                  <th className="p-3 font-semibold">Identified Risk</th>
                  <th className="p-3 font-semibold">Implemented Countermeasure</th>
                  <th className="p-3 font-semibold">Verification Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262629]">
                <tr>
                  <td className="flex items-center gap-2 p-3 font-medium text-[#F1F1F1]">
                    <Lock className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                    1. Input Surfaces
                  </td>
                  <td className="p-3 text-[#A0A0A5]">
                    Malicious payloads, prompt injection, overlong buffers crashing servers.
                  </td>
                  <td className="p-3 text-[#A0A0A5]">
                    Express strict JSON limit (2MB), defensive payload null-guards, prompt sanitization.
                  </td>
                  <td className="p-3 font-medium text-emerald-400">Enforced in backend</td>
                </tr>

                <tr>
                  <td className="flex items-center gap-2 p-3 font-medium text-[#F1F1F1]">
                    <Cpu className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                    2. Planning & Reasoning
                  </td>
                  <td className="p-3 text-[#A0A0A5]">
                    Indirect prompt injection tricking Gemini into executing unauthorized commands.
                  </td>
                  <td className="p-3 text-[#A0A0A5]">
                    User inputs treated as passive plain data; robust system instructions isolate user reflection text.
                  </td>
                  <td className="p-3 font-medium text-emerald-400">Enforced in Gemini helper</td>
                </tr>

                <tr>
                  <td className="flex items-center gap-2 p-3 font-medium text-[#F1F1F1]">
                    <Shield className="h-3.5 w-3.5 shrink-0 text-purple-400" />
                    3. Tool Execution
                  </td>
                  <td className="p-3 text-[#A0A0A5]">
                    Model outages, 429 quota exhaustion, or 503 service downtime breaking app state.
                  </td>
                  <td className="p-3 text-[#A0A0A5]">
                    Automated 5-model Fallback Ladder (gemini-3.7-flash &rarr; 3.6-flash &rarr; 3.5-flash &rarr; flash-latest &rarr; 3.1-flash-lite).
                  </td>
                  <td className="p-3 font-medium text-emerald-400">Tested & active</td>
                </tr>

                <tr>
                  <td className="flex items-center gap-2 p-3 font-medium text-[#F1F1F1]">
                    <Database className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    4. Memory & State
                  </td>
                  <td className="p-3 text-[#A0A0A5]">
                    Cross-user data leakage, unauthorized reads/writes in Firestore.
                  </td>
                  <td className="p-3 text-[#A0A0A5]">
                    Owner-bound Firestore Security Rules (<code className="font-mono text-amber-400">request.auth.uid == userId</code>) + recursive undefined stripping.
                  </td>
                  <td className="p-3 font-medium text-emerald-400">Deployed to Firebase</td>
                </tr>

                <tr>
                  <td className="flex items-center gap-2 p-3 font-medium text-[#F1F1F1]">
                    <Network className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                    5. Inter-System Comm
                  </td>
                  <td className="p-3 text-[#A0A0A5]">
                    Exposing Gemini API key to client browsers or committing secrets to git.
                  </td>
                  <td className="p-3 text-[#A0A0A5]">
                    Zero client-side secrets; Gemini calls run exclusively server-side via environment variables / Secret Manager.
                  </td>
                  <td className="p-3 font-medium text-emerald-400">Strict Server Proxy</td>
                </tr>

                <tr>
                  <td className="flex items-center gap-2 p-3 font-medium text-[#F1F1F1]">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
                    6. Maps API Exposure
                  </td>
                  <td className="p-3 text-[#A0A0A5]">
                    Google Maps/Places API keys exposed to client-side JavaScript, enabling quota theft or abuse.
                  </td>
                  <td className="p-3 text-[#A0A0A5]">
                    Places Autocomplete proxied server-side with restricted <code className="font-mono text-amber-400">GOOGLE_MAPS_API_KEY</code>. Client uses separate Maps JS API key with HTTP referrer restrictions.
                  </td>
                  <td className="p-3 font-medium text-emerald-400">Dual-Key Isolation</td>
                </tr>

                <tr>
                  <td className="flex items-center gap-2 p-3 font-medium text-[#F1F1F1]">
                    <Crown className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                    7. RBAC Privilege Escalation
                  </td>
                  <td className="p-3 text-[#A0A0A5]">
                    Regular users elevating to admin role, accessing other users' data or admin endpoints.
                  </td>
                  <td className="p-3 text-[#A0A0A5]">
                    Admin role seeded via <code className="font-mono text-amber-400">ADMIN_EMAILS</code> env var. Server verifies Firebase ID token + email on every admin request. No client-side role toggling.
                  </td>
                  <td className="p-3 font-medium text-emerald-400">Server-Side RBAC</td>
                </tr>

                <tr>
                  <td className="flex items-center gap-2 p-3 font-medium text-[#F1F1F1]">
                    <Bell className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
                    8. Webhook Credential Leakage
                  </td>
                  <td className="p-3 text-[#A0A0A5]">
                    Slack/Discord webhook URLs stored in client-accessible Firestore, allowing injection of spam notifications.
                  </td>
                  <td className="p-3 text-[#A0A0A5]">
                    Webhook URLs stored under user-isolated Firestore path (<code className="font-mono text-amber-400">{'/users/{userId}/settings/'}</code>). Notifications dispatched server-side only. Webhook URLs never returned to client after save.
                  </td>
                  <td className="p-3 font-medium text-emerald-400">Server-Only Dispatch</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Firestore Security Rules Preview */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[#888]">
            Deployed firestore.rules
          </h4>
          <pre className="overflow-x-auto rounded-xl border border-[#262629] bg-[#080809] p-4 font-mono text-xs leading-relaxed text-[#D5D5DB]">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      match /interactions/{interactionId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      match /{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}`}
          </pre>
        </div>
      </div>
    </Modal>
  );
};

export default ThreatModelModal;