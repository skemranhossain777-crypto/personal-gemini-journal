import React, { useState, useEffect } from 'react';
import {
  Bell,
  X,
  Check,
  Loader2,
  Send,
  Webhook,
  Brain,
  MessageSquare,
  Lightbulb,
  FileText,
} from 'lucide-react';
import type { NotificationSettings, ReflectionMode } from '../types';

interface NotificationSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  authToken: string;
}

export const NotificationSettingsModal: React.FC<NotificationSettingsProps> = ({
  isOpen,
  onClose,
  authToken,
}) => {
  const [settings, setSettings] = useState<NotificationSettings>({
    enabled: false,
    notifyOn: ['reflect', 'summarize', 'brainstorm', 'chat'],
    slackWebhookUrl: '',
    discordWebhookUrl: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const resp = await fetch('/api/notifications/settings', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        setSettings({
          enabled: data.enabled ?? false,
          notifyOn: data.notifyOn || ['reflect', 'summarize', 'brainstorm', 'chat'],
          slackWebhookUrl: data.slackWebhookUrl || '',
          discordWebhookUrl: data.discordWebhookUrl || '',
        });
      }
    } catch {
      // use defaults
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
      setMessage(null);
    }
  }, [isOpen]);

  const saveSettings = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const resp = await fetch('/api/notifications/settings', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });
      if (resp.ok) {
        setMessage({ type: 'success', text: 'Notification settings saved' });
      } else {
        setMessage({ type: 'error', text: 'Failed to save settings' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error saving settings' });
    } finally {
      setIsSaving(false);
    }
  };

  const testNotification = async (channel: 'slack' | 'discord') => {
    const url = channel === 'slack' ? settings.slackWebhookUrl : settings.discordWebhookUrl;
    if (!url) {
      setMessage({ type: 'error', text: `Enter a ${channel} webhook URL first` });
      return;
    }
    setIsTesting(channel);
    setMessage(null);
    try {
      const resp = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ channel, webhookUrl: url }),
      });
      const data = await resp.json();
      if (data.success) {
        setMessage({ type: 'success', text: `Test ${channel} notification sent!` });
      } else {
        setMessage({ type: 'error', text: `Failed to send test to ${channel}` });
      }
    } catch {
      setMessage({ type: 'error', text: `Network error testing ${channel}` });
    } finally {
      setIsTesting(null);
    }
  };

  const toggleNotifyOn = (mode: ReflectionMode) => {
    setSettings((prev) => ({
      ...prev,
      notifyOn: prev.notifyOn.includes(mode)
        ? prev.notifyOn.filter((m) => m !== mode)
        : [...prev.notifyOn, mode],
    }));
  };

  const modeOptions: { id: ReflectionMode; label: string; icon: typeof Brain }[] = [
    { id: 'reflect', label: 'Reflect', icon: Brain },
    { id: 'summarize', label: 'Summary', icon: FileText },
    { id: 'brainstorm', label: 'Brainstorm', icon: Lightbulb },
    { id: 'chat', label: 'Chat', icon: MessageSquare },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-[#0E0E10] border border-[#262629] text-[#E0E0E0] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#262629] px-6 py-4 bg-[#121214]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-950/60 border border-blue-800/40 text-blue-400">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#F1F1F1]">Notification Settings</h2>
              <p className="text-xs text-[#888]">Get notified when journal entries are saved</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#888] hover:bg-[#1A1A1C] hover:text-[#F1F1F1] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-[#888] text-xs gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading settings...
            </div>
          ) : (
            <>
              {/* Enable Toggle */}
              <div className="flex items-center justify-between rounded-xl border border-[#262629] bg-[#121214] p-4">
                <div>
                  <p className="text-sm font-medium text-[#F1F1F1]">Enable Notifications</p>
                  <p className="text-xs text-[#888] mt-0.5">Receive alerts when entries are saved</p>
                </div>
                <button
                  onClick={() => setSettings((p) => ({ ...p, enabled: !p.enabled }))}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    settings.enabled ? 'bg-emerald-600' : 'bg-[#262629]'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      settings.enabled ? 'left-[22px]' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Webhook URLs */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-[#888] uppercase tracking-wider flex items-center gap-2">
                  <Webhook className="h-3.5 w-3.5" />
                  Webhook URLs
                </h3>

                {/* Slack */}
                <div className="space-y-1.5">
                  <label className="text-xs text-[#A0A0A5] font-medium">Slack Webhook URL</label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://hooks.slack.com/services/..."
                      value={settings.slackWebhookUrl || ''}
                      onChange={(e) => setSettings((p) => ({ ...p, slackWebhookUrl: e.target.value }))}
                      className="flex-1 rounded-lg border border-[#262629] bg-[#161619] px-3 py-2 text-xs text-[#F1F1F1] placeholder:text-[#555] focus:border-[#444] focus:outline-none"
                    />
                    <button
                      onClick={() => testNotification('slack')}
                      disabled={isTesting === 'slack' || !settings.slackWebhookUrl}
                      className="flex items-center gap-1 rounded-lg border border-[#262629] bg-[#161619] px-3 py-2 text-xs text-[#888] hover:bg-[#1E1E22] hover:text-[#F1F1F1] disabled:opacity-40 transition-colors"
                    >
                      {isTesting === 'slack' ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Send className="h-3 w-3" />
                      )}
                      <span>Test</span>
                    </button>
                  </div>
                </div>

                {/* Discord */}
                <div className="space-y-1.5">
                  <label className="text-xs text-[#A0A0A5] font-medium">Discord Webhook URL</label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://discord.com/api/webhooks/..."
                      value={settings.discordWebhookUrl || ''}
                      onChange={(e) => setSettings((p) => ({ ...p, discordWebhookUrl: e.target.value }))}
                      className="flex-1 rounded-lg border border-[#262629] bg-[#161619] px-3 py-2 text-xs text-[#F1F1F1] placeholder:text-[#555] focus:border-[#444] focus:outline-none"
                    />
                    <button
                      onClick={() => testNotification('discord')}
                      disabled={isTesting === 'discord' || !settings.discordWebhookUrl}
                      className="flex items-center gap-1 rounded-lg border border-[#262629] bg-[#161619] px-3 py-2 text-xs text-[#888] hover:bg-[#1E1E22] hover:text-[#F1F1F1] disabled:opacity-40 transition-colors"
                    >
                      {isTesting === 'discord' ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Send className="h-3 w-3" />
                      )}
                      <span>Test</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Entry Type Filters */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-[#888] uppercase tracking-wider">
                  Notify On
                </h3>
                <div className="flex flex-wrap gap-2">
                  {modeOptions.map((opt) => {
                    const Icon = opt.icon;
                    const isActive = settings.notifyOn.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        onClick={() => toggleNotifyOn(opt.id)}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                          isActive
                            ? 'bg-[#24242A] border border-[#3E3E44] text-[#F1F1F1]'
                            : 'bg-[#161619] border border-[#262629] text-[#888] hover:text-[#E0E0E0]'
                        }`}
                      >
                        {isActive && <Check className="h-3 w-3 text-emerald-400" />}
                        <Icon className="h-3.5 w-3.5" />
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Status message */}
              {message && (
                <div
                  className={`rounded-xl border p-3 text-xs ${
                    message.type === 'success'
                      ? 'border-emerald-800/40 bg-emerald-950/30 text-emerald-300'
                      : 'border-red-900/50 bg-red-950/30 text-red-300'
                  }`}
                >
                  {message.text}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#262629] bg-[#121214] px-6 py-3">
          <p className="text-[10px] text-[#666]">Webhooks fire server-side after each saved entry</p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-xl bg-[#1A1A1C] border border-[#333338] px-4 py-2 text-xs font-medium text-[#888] hover:text-[#F1F1F1] hover:bg-[#242428] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveSettings}
              disabled={isSaving}
              className="flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-60 transition-colors"
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              <span>Save Settings</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
