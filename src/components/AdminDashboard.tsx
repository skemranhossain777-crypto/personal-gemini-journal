import React, { useState, useEffect } from 'react';
import {
  Shield,
  Users,
  BarChart3,
  Activity,
  RefreshCw,
  Crown,
  UserCheck,
} from 'lucide-react';
import { motion } from 'motion/react';
import { Modal } from './Modal';

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Admin Dashboard"
      description="Role-based access control & system overview"
      icon={<Shield className="h-5 w-5" />}
      iconClassName="bg-amber-950/60 border border-amber-800/40 text-amber-400"
      maxWidthClass="max-w-5xl"
      headerExtra={
        <button
          onClick={fetchUsers}
          className="flex items-center gap-1.5 rounded-lg border border-[#262629] bg-[#161619] px-3 py-1.5 text-xs font-medium text-[#E0E0E0] transition-colors hover:bg-[#1E1E22]"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      }
      footer={
        <button
          onClick={onClose}
          className="rounded-xl border border-[#333338] bg-[#1A1A1C] px-4 py-2 text-xs font-medium text-[#F1F1F1] transition-colors hover:border-[#44444C] hover:bg-[#242428]"
        >
          Close Dashboard
        </button>
      }
    >
      <div className="p-6">
        {/* Stats Bar */}
        <div className="mb-6 grid grid-cols-3 gap-4 rounded-2xl border border-[#262629] bg-[#0E0E10] p-4">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
            className="rounded-xl border border-[#262629] bg-[#121214] p-4"
          >
            <div className="mb-1 flex items-center gap-2 text-xs font-medium text-[#888]">
              <Users className="h-3.5 w-3.5" />
              Total Users
            </div>
            <p className="text-2xl font-bold text-[#F1F1F1]">{stats.totalUsers}</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.12 }}
            className="rounded-xl border border-[#262629] bg-[#121214] p-4"
          >
            <div className="mb-1 flex items-center gap-2 text-xs font-medium text-[#888]">
              <BarChart3 className="h-3.5 w-3.5" />
              Total Interactions
            </div>
            <p className="text-2xl font-bold text-[#F1F1F1]">{stats.totalInteractions}</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.19 }}
            className="rounded-xl border border-[#262629] bg-[#121214] p-4"
          >
            <div className="mb-1 flex items-center gap-2 text-xs font-medium text-[#888]">
              <Activity className="h-3.5 w-3.5" />
              Admin Seed
            </div>
            <p className="mt-1 text-xs font-medium text-emerald-400">ADMIN_EMAILS env active</p>
          </motion.div>
        </div>

        {/* Users Table */}
        {error && (
          <div className="mb-4 rounded-xl border border-red-900/50 bg-red-950/30 p-3 text-xs text-red-300">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-xs text-[#888]">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#262629] border-t-amber-500" />
            Loading users from Firestore...
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-xs text-[#888]">
            <Users className="h-8 w-8 text-[#666]" />
            <p>No user data available</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#262629]">
            <table className="w-full text-left text-xs text-[#A0A0A5]">
              <thead className="border-b border-[#262629] bg-[#161619] text-[#F1F1F1]">
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
                  <tr key={user.uid} className="transition-colors hover:bg-[#121214]">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[#262629] bg-[#1A1A1C] text-[10px] font-semibold text-[#888]">
                          {user.displayName?.[0] || user.email?.[0] || '?'}
                        </div>
                        <span className="max-w-[150px] truncate font-medium text-[#F1F1F1]">
                          {user.displayName || 'Anonymous'}
                        </span>
                      </div>
                    </td>
                    <td className="max-w-[200px] truncate p-3 text-[#888]">{user.email || '—'}</td>
                    <td className="p-3">
                      {user.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-amber-800/60 bg-amber-950/50 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                          <Crown className="h-2.5 w-2.5" />
                          Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md border border-[#262629] bg-[#1A1A1C] px-2 py-0.5 text-[10px] font-medium text-[#888]">
                          <UserCheck className="h-2.5 w-2.5" />
                          User
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-mono">{user.interactionCount}</td>
                    <td className="p-3 text-[#666]">
                      {user.lastActive ? new Date(user.lastActive).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Admin Info */}
        <div className="mt-6 rounded-xl border border-amber-900/40 bg-[#161410] p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-amber-400">
            <Shield className="h-3.5 w-3.5" />
            RBAC Configuration
          </div>
          <div className="space-y-1 text-xs text-[#D5D5DB]">
            <p>
              Admin role is seeded via{' '}
              <code className="rounded bg-[#0E0E10] px-1 font-mono text-amber-400">ADMIN_EMAILS</code>{' '}
              environment variable.
            </p>
            <p>
              Current admin: <span className="font-medium text-amber-300">{adminEmail}</span>
            </p>
            <p className="mt-2 text-[#888]">
              Admins can view all users, manage roles, and access the admin dashboard. Additional
              admins can be added by appending emails to the ADMIN_EMAILS env var (comma-separated).
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
};
