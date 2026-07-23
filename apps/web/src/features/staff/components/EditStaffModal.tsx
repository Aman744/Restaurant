import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { UserProfile, UserRole } from '@restaurant-qr/core';
import { StaffService } from '../../../services/StaffService';
import { useToast } from '../../../components/shared/ToastContext';
import { ShieldAlert } from 'lucide-react';

const editStaffSchema = z.object({
  displayName: z.string().min(2, 'Name must be at least 2 characters'),
  role: z.enum(['manager', 'kitchen-staff', 'waiter', 'cashier', 'restaurant-admin'])
});

type EditStaffFormData = z.infer<typeof editStaffSchema>;

interface EditStaffModalProps {
  tenantId: string;
  isMockMode: boolean;
  member: UserProfile | null;
  onClose: () => void;
}

export const EditStaffModal: React.FC<EditStaffModalProps> = ({
  tenantId,
  isMockMode,
  member,
  onClose
}) => {
  const toast = useToast();
  const [newPassword, setNewPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<EditStaffFormData>({
    resolver: zodResolver(editStaffSchema),
    defaultValues: {
      displayName: '',
      role: 'waiter'
    }
  });

  useEffect(() => {
    if (member) {
      setValue('displayName', member.displayName);
      setValue('role', member.role as any);
      setNewPassword('');
    }
  }, [member, setValue]);

  if (!member) return null;

  const onSubmit = async (data: EditStaffFormData) => {
    try {
      await StaffService.updateStaffMember(
        tenantId,
        member.uid,
        {
          displayName: data.displayName,
          role: data.role as UserRole
        },
        isMockMode
      );
      toast.success(`Updated details for ${data.displayName}.`);
      onClose();
    } catch (err: any) {
      toast.error(`Update failed: ${err.message}`);
    }
  };

  const handleResetPassword = async () => {
    if (!isMockMode && !newPassword) {
      setResettingPassword(true);
      try {
        await StaffService.resetStaffPassword(tenantId, member.uid, member.email, undefined, isMockMode);
        toast.success(`Password reset email sent to ${member.email}.`);
      } catch (err: any) {
        toast.error(`Reset email failed: ${err.message}`);
      } finally {
        setResettingPassword(false);
      }
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }

    setResettingPassword(true);
    try {
      await StaffService.resetStaffPassword(tenantId, member.uid, member.email, newPassword, isMockMode);
      toast.success(`Successfully reset password for ${member.displayName}.`);
      setNewPassword('');
    } catch (err: any) {
      toast.error(`Password reset failed: ${err.message}`);
    } finally {
      setResettingPassword(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <style dangerouslySetInnerHTML={{__html: `
        input:-webkit-autofill,
        input:-webkit-autofill:hover, 
        input:-webkit-autofill:focus, 
        input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 1000px #18181b inset !important;
          -webkit-text-fill-color: #f4f4f5 !important;
          transition: background-color 5000s ease-in-out 0s;
        }
      `}} />
      <div className="w-full max-w-sm border border-zinc-800 bg-zinc-950 p-6 shadow-2xl rounded-3xl text-white space-y-6 animate-fadeIn">
        <div>
          <h3 className="text-base font-extrabold text-white">Edit Staff Details</h3>
          <p className="text-[10px] text-zinc-500 font-mono mt-0.5">UID: {member.uid}</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-zinc-400 font-semibold uppercase">Full Name</label>
            <input
              {...register('displayName')}
              className="w-full border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-xs text-zinc-200 rounded-xl focus:outline-none focus:border-emerald-500/30"
              placeholder="Full Name"
            />
            {errors.displayName && <p className="text-[10px] text-red-400">{errors.displayName.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-400 font-semibold uppercase">Assigned Role</label>
            <select
              {...register('role')}
              className="w-full border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-xs text-zinc-200 rounded-xl focus:outline-none"
            >
              <option value="waiter">Waiter</option>
              <option value="kitchen-staff">Kitchen Staff</option>
              <option value="cashier">Cashier</option>
              <option value="manager">Manager</option>
              <option value="restaurant-admin">Restaurant Admin</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-semibold rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-500/10 transition"
            >
              {isSubmitting ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>

        <div className="border-t border-zinc-900 pt-4 space-y-3">
          <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Account Password Recovery</h4>
          
          <div className="space-y-2">
            <input
              type={isPasswordFocused || newPassword ? "password" : "text"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              onFocus={() => setIsPasswordFocused(true)}
              onBlur={() => {
                if (!newPassword) setIsPasswordFocused(false);
              }}
              placeholder="Type new 6+ char password"
              autoComplete="new-password"
              className="w-full border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 rounded-xl focus:outline-none focus:border-red-500/30"
              style={{
                WebkitBoxShadow: '0 0 0 1000px #18181b inset',
                WebkitTextFillColor: '#f4f4f5',
                backgroundColor: '#18181b',
                color: '#f4f4f5'
              }}
            />
            
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={resettingPassword}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-zinc-900 hover:bg-zinc-850 text-zinc-200 border border-zinc-800 text-xs text-red-400 font-bold rounded-xl transition cursor-pointer"
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                {newPassword ? 'Apply New Pass' : 'Send Reset Email'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
