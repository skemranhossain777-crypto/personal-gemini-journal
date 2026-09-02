import React, { useState, useEffect } from 'react';
import {
  Shield,
  Users,
  BarChart3,
  Activity,
  X,
  RefreshCw,
  Crown,
  UserCheck,
} from 'lucide-react';

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  authToken: string;
  adminEmail: string;
}

interface UserRecord {
  uid: string;
  displayName: string | null;
  email: string | null;
  role: string;
  interactionCount: number;
  lastActive: string | null;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  isOpen,
  onClose,
  authToken,
  adminEmail,
}) => {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ totalUsers: 0, totalInteractions: 0 });

  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!resp.ok) {
        const data = await resp.json();
        throw new Error(data.error || 'Failed to fetch users');
      }
      const data = await resp.json();
      const userList = data.users || [];
      setUsers(userList);
      setStats({
        totalUsers: userList.length,
        totalInteractions: userList.reduce((sum: number, u: UserRecord) => sum + (u.interactionCount || 0), 0),
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load admin data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchUsers();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[90vh] w-full max-w-5xl flex-col rounded-2xl bg-[#0E0E10] border border-[#262629] text-[#E0E0E0] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#262629] px-6 py-4 bg-[#121214]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-950/60 border border-amber-800/40 text-amber-400">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#F1F1F1]">Admin Dashboard</h2>
              <p className="text-xs text-[#888]">Role-based access control & system overview</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchUsers}
              className="flex items-center gap-1.5 rounded-lg border border-[#262629] bg-[#161619] px-3 py-1.5 text-xs font-medium text-[#E0E0E0] hover:bg-[#1E1E22] transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-[#888] hover:bg-[#1A1A1C] hover:text-[#F1F1F1] transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-4 px-6 py-4 bg-[#0E0E10] border-b border-[#262629]">
          <div className="rounded-xl border border-[#262629] bg-[#121214] p-4">
            <div className="flex items-center gap-2 text-[#888] text-xs font-medium mb-1">
              <Users className="h-3.5 w-3.5" />
              Total Users
            </div>
            <p className="text-2xl font-bold text-[#F1F1F1]">{stats.totalUsers}</p>
          </div>
          <div className="rounded-xl border border-[#262629] bg-[#121214] p-4">
            <div className="flex items-center gap-2 text-[#888] text-xs font-medium mb-1">
              <BarChart3 className="h-3.5 w-3.5" />
              Total Interactions
            </div>
            <p className="text-2xl font-bold text-[#F1F1F1]">{stats.totalInteractions}</p>
          </div>
          <div className="rounded-xl border border-[#262629] bg-[#121214] p-4">
            <div className="flex items-center gap-2 text-[#888] text-xs font-medium mb-1">
              <Activity className="h-3.5 w-3.5" />
              Admin Seed
            </div>
            <p className="text-xs text-emerald-400 font-medium mt-1">ADMIN_EMAILS env active</p>
          </div>
        </div>

        {/* Users Table */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 rounded-xl border border-red-900/50 bg-red-950/30 p-3 text-xs text-red-300">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-[#888] text-xs gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#262629] border-t-amber-500" />
              Loading users from Firestore...
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[#888] text-xs gap-2">
              <Users className="h-8 w-8 text-[#666]" />
              <p>No user data available</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#262629]">
              <table className="w-full text-left text-xs text-[#A0A0A5]">
                <thead className="bg-[#161619] text-[#F1F1F1] border-b border-[#262629]">
                  <tr>
                    <th className="p-3 font-semibold">User</th>
                    <th className="p-3 font-semibold">Email</th>
                    <th className="p-3 font-semibold">Role</th>
                    <th className="p-3 font-semibold">Interactions</th>
                    <th className="p-3 font-semibold">Last Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#262629]">
                  {users.map((user) => (
                    <tr key={user.uid} className="hover:bg-[#121214] transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-[#1A1A1C] border border-[#262629] flex items-center justify-center text-[10px] font-semibold text-[#888]">
                            {user.displayName?.[0] || user.email?.[0] || '?'}
                          </div>
                          <span className="text-[#F1F1F1] font-medium truncate max-w-[150px]">
                            {user.displayName || 'Anonymous'}
                          </span>
                        </div>
                      </td>
                      <td className="p-3 text-[#888] truncate max-w-[200px]">{user.email || '—'}</td>
                      <td className="p-3">
                        {user.role === 'admin' ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-950/50 px-2 py-0.5 text-[10px] font-medium text-amber-300 border border-amber-800/60">
                            <Crown className="h-2.5 w-2.5" />
                            Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-[#1A1A1C] px-2 py-0.5 text-[10px] font-medium text-[#888] border border-[#262629]">
                            <UserCheck className="h-2.5 w-2.5" />
                            User
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-mono">{user.interactionCount}</td>
                      <td className="p-3 text-[#666]">
                        {user.lastActive
                          ? new Date(user.lastActive).toLocaleDateString()
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Admin Info */}
          <div className="mt-6 rounded-xl border border-amber-900/40 bg-[#161410] p-4">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold mb-2">
              <Shield className="h-3.5 w-3.5" />
              RBAC Configuration
            </div>
            <div className="space-y-1 text-xs text-[#D5D5DB]">
              <p>Admin role is seeded via <code className="text-amber-400 font-mono bg-[#0E0E10] px-1 rounded">ADMIN_EMAILS</code> environment variable.</p>
              <p>Current admin: <span className="text-amber-300 font-medium">{adminEmail}</span></p>
              <p className="text-[#888] mt-2">
                Admins can view all users, manage roles, and access the admin dashboard.
                Additional admins can be added by appending emails to the ADMIN_EMAILS env var (comma-separated).
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-[#262629] bg-[#121214] px-6 py-3">
          <button
            onClick={onClose}
            className="rounded-xl bg-[#1A1A1C] border border-[#333338] px-4 py-2 text-xs font-medium text-[#F1F1F1] hover:bg-[#242428] hover:border-[#44444C] transition-colors"
          >
            Close Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
