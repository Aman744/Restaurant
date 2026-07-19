import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { UserRole } from '@restaurant-qr/core';
import { useStaffStore } from '../../../stores/useStaffStore';
import { StaffService } from '../../../services/StaffService';
import { useToast } from '../../../components/shared/ToastContext';

const staffSchema = z.object({
  displayName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['manager', 'kitchen-staff', 'waiter', 'cashier'])
});

type StaffFormData = z.infer<typeof staffSchema>;

interface AddStaffModalProps {
  tenantId: string;
  isMockMode: boolean;
}

export const AddStaffModal: React.FC<AddStaffModalProps> = ({ tenantId, isMockMode }) => {
  const { isAddModalOpen, setAddModalOpen } = useStaffStore();
  const toast = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<StaffFormData>({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
      role: 'waiter'
    }
  });

  const onSubmit = async (data: StaffFormData) => {
    try {
      await StaffService.createStaffMember(
        tenantId,
        data.displayName,
        data.email,
        data.role as UserRole,
        data.password,
        isMockMode
      );
      toast.success(`Provisioned staff account for ${data.displayName}.`);
      setAddModalOpen(false);
      reset();
    } catch (err: any) {
      toast.error(`Failed to add staff: ${err.message}`);
    }
  };

  if (!isAddModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm border border-zinc-800 bg-zinc-950 p-6 shadow-2xl rounded-3xl text-white">
        <h3 className="text-lg font-bold mb-4">Add Staff Member</h3>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-zinc-400 font-semibold uppercase">Full Name</label>
            <input
              {...register('displayName')}
              className="w-full border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-xs text-zinc-200 rounded-xl focus:outline-none focus:border-emerald-500/30"
              placeholder="e.g. John Waiter"
            />
            {errors.displayName && <p className="text-[10px] text-red-400">{errors.displayName.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-400 font-semibold uppercase">Email Address</label>
            <input
              type="email"
              {...register('email')}
              className="w-full border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-xs text-zinc-200 rounded-xl focus:outline-none focus:border-emerald-500/30"
              placeholder="john@restaurant.com"
            />
            {errors.email && <p className="text-[10px] text-red-400">{errors.email.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-400 font-semibold uppercase">Account Password</label>
            <input
              type="password"
              {...register('password')}
              className="w-full border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-xs text-zinc-200 rounded-xl focus:outline-none focus:border-emerald-500/30"
              placeholder="••••••••"
            />
            {errors.password && <p className="text-[10px] text-red-400">{errors.password.message}</p>}
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
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setAddModalOpen(false)}
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-semibold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-500/10"
            >
              {isSubmitting ? 'Provisioning...' : 'Add Staff'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
