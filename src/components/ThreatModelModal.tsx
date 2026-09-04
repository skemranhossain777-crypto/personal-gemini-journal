import React from 'react';
import { Shield, Lock, Database, Cpu, Network, X, CheckCircle2, MapPin, Crown, Bell } from 'lucide-react';

interface ThreatModelModalProps {
  isOpen: boolean;
  onClose: () => void;
  userUid?: string;
}

export const ThreatModelModal: React.FC<ThreatModelModalProps> = ({ isOpen, onClose, userUid }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-[#0E0E10] border border-[#262629] text-[#E0E0E0] shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#262629] px-6 py-4 bg-[#121214]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-950/60 border border-emerald-800/40 text-emerald-400">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#F1F1F1]">Agentic Threat Modeling & Security Posture</h2>
              <p className="text-xs text-[#888]">8 Threat Zones mapped to production defenses and verification</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#888] hover:bg-[#1A1A1C] hover:text-[#F1F1F1] transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#0E0E10]">
          {/* User isolation active path */}
          <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/20 p-4">
            <div className="flex items-center gap-2 text-emerald-300 text-sm font-medium mb-1">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Active Database Isolation Path
            </div>
            <p className="text-xs text-[#D5D5DB] font-mono break-all">
              {userUid
                ? `/users/${userUid}/interactions/{interactionId}`
                : 'Unauthenticated (Requires Google Sign-In to generate user partition)'}
            </p>
            <p className="text-xs text-[#888] mt-2">
              Protected by server-enforced Firestore Rules: only the authenticated owner whose UID matches the document path is permitted read and write access.
            </p>
          </div>

          {/* Threat Summary Table (8 Threat Zones) */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-[#888] uppercase tracking-wider">
              Threat Summary Table (8 Threat Zones)
            </h3>
            <div className="overflow-x-auto rounded-xl border border-[#262629]">
              <table className="w-full text-left text-xs text-[#A0A0A5]">
                <thead className="bg-[#161619] text-[#F1F1F1] border-b border-[#262629]">
                  <tr>
                    <th className="p-3 font-semibold">Threat Zone</th>
                    <th className="p-3 font-semibold">Identified Risk</th>
                    <th className="p-3 font-semibold">Implemented Countermeasure</th>
                    <th className="p-3 font-semibold">Verification Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#262629]">
                  <tr>
                    <td className="p-3 font-medium text-[#F1F1F1] flex items-center gap-2">
                      <Lock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                      1. Input Surfaces
                    </td>
                    <td className="p-3 text-[#A0A0A5]">
                      Malicious payloads, prompt injection, overlong buffers crashing servers.
                    </td>
                    <td className="p-3 text-[#A0A0A5]">
                      Express strict JSON limit (2MB), defensive payload null-guards, prompt sanitization.
                    </td>
                    <td className="p-3 text-emerald-400 font-medium">Enforced in backend</td>
                  </tr>

                  <tr>
                    <td className="p-3 font-medium text-[#F1F1F1] flex items-center gap-2">
                      <Cpu className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                      2. Planning & Reasoning
                    </td>
                    <td className="p-3 text-[#A0A0A5]">
                      Indirect prompt injection tricking Gemini into executing unauthorized commands.
                    </td>
                    <td className="p-3 text-[#A0A0A5]">
                      User inputs treated as passive plain data; robust system instructions isolate user reflection text.
                    </td>
                    <td className="p-3 text-emerald-400 font-medium">Enforced in Gemini helper</td>
                  </tr>

                  <tr>
                    <td className="p-3 font-medium text-[#F1F1F1] flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                      3. Tool Execution
                    </td>
                    <td className="p-3 text-[#A0A0A5]">
                      Model outages, 429 quota exhaustion, or 503 service downtime breaking app state.
                    </td>
                    <td className="p-3 text-[#A0A0A5]">
                      Automated 5-model Fallback Ladder (gemini-3.7-flash &rarr; 3.6-flash &rarr; 3.5-flash &rarr; flash-latest &rarr; 3.1-flash-lite).
                    </td>
                    <td className="p-3 text-emerald-400 font-medium">Tested & active</td>
                  </tr>

                  <tr>
                    <td className="p-3 font-medium text-[#F1F1F1] flex items-center gap-2">
                      <Database className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      4. Memory & State
                    </td>
                    <td className="p-3 text-[#A0A0A5]">
                      Cross-user data leakage, unauthorized reads/writes in Firestore.
                    </td>
                    <td className="p-3 text-[#A0A0A5]">
                      Owner-bound Firestore Security Rules (<code className="text-amber-400 font-mono">request.auth.uid == userId</code>) + recursive undefined stripping.
                    </td>
                    <td className="p-3 text-emerald-400 font-medium">Deployed to Firebase</td>
                  </tr>

                  <tr>
                    <td className="p-3 font-medium text-[#F1F1F1] flex items-center gap-2">
                      <Network className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                      5. Inter-System Comm
                    </td>
                    <td className="p-3 text-[#A0A0A5]">
                      Exposing Gemini API key to client browsers or committing secrets to git.
                    </td>
                    <td className="p-3 text-[#A0A0A5]">
                      Zero client-side secrets; Gemini calls run exclusively server-side via environment variables / Secret Manager.
                    </td>
                    <td className="p-3 text-emerald-400 font-medium">Strict Server Proxy</td>
                  </tr>

                  <tr>
                    <td className="p-3 font-medium text-[#F1F1F1] flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                      6. Maps API Exposure
                    </td>
                    <td className="p-3 text-[#A0A0A5]">
                      Google Maps/Places API keys exposed to client-side JavaScript, enabling quota theft or abuse.
                    </td>
                    <td className="p-3 text-[#A0A0A5]">
                      Places Autocomplete proxied server-side with restricted <code className="text-amber-400 font-mono">GOOGLE_MAPS_API_KEY</code>. Client uses separate Maps JS API key with HTTP referrer restrictions.
                    </td>
                    <td className="p-3 text-emerald-400 font-medium">Dual-Key Isolation</td>
                  </tr>

                  <tr>
                    <td className="p-3 font-medium text-[#F1F1F1] flex items-center gap-2">
                      <Crown className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                      7. RBAC Privilege Escalation
                    </td>
                    <td className="p-3 text-[#A0A0A5]">
                      Regular users elevating to admin role, accessing other users' data or admin endpoints.
                    </td>
                    <td className="p-3 text-[#A0A0A5]">
                      Admin role seeded via <code className="text-amber-400 font-mono">ADMIN_EMAILS</code> env var. Server verifies Firebase ID token + email on every admin request. No client-side role toggling.
                    </td>
                    <td className="p-3 text-emerald-400 font-medium">Server-Side RBAC</td>
                  </tr>

                  <tr>
                    <td className="p-3 font-medium text-[#F1F1F1] flex items-center gap-2">
                      <Bell className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                      8. Webhook Credential Leakage
                    </td>
                    <td className="p-3 text-[#A0A0A5]">
                      Slack/Discord webhook URLs stored in client-accessible Firestore, allowing injection of spam notifications.
                    </td>
                    <td className="p-3 text-[#A0A0A5]">
                      Webhook URLs stored under user-isolated Firestore path (<code className="text-amber-400 font-mono">{'/users/{userId}/settings/'}</code>). Notifications dispatched server-side only. Webhook URLs never returned to client after save.
                    </td>
                    <td className="p-3 text-emerald-400 font-medium">Server-Only Dispatch</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Firestore Security Rules Preview */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-[#888] uppercase tracking-wider">
              Deployed firestore.rules
            </h4>
            <pre className="rounded-xl bg-[#080809] p-4 text-xs font-mono text-[#D5D5DB] overflow-x-auto border border-[#262629] leading-relaxed">
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

        {/* Modal Footer */}
        <div className="flex items-center justify-end border-t border-[#262629] bg-[#121214] px-6 py-3">
          <button
            onClick={onClose}
            className="rounded-xl bg-[#1A1A1C] border border-[#333338] px-4 py-2 text-xs font-medium text-[#F1F1F1] hover:bg-[#242428] hover:border-[#44444C] transition-colors"
          >
            Close Threat Model
          </button>
        </div>
      </div>
    </div>
  );
};
