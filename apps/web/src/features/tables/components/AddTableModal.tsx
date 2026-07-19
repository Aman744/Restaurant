import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTableStore } from '../../../stores/useTableStore';
import { TableService } from '../../../services/TableService';
import { useToast } from '../../../components/shared/ToastContext';

const tableSchema = z.object({
  number: z.string().min(1, 'Table number is required'),
  seatingCapacity: z.number().min(1, 'Seating capacity must be at least 1')
});

type TableFormData = z.infer<typeof tableSchema>;

interface AddTableModalProps {
  tenantId: string;
  isMockMode: boolean;
}

export const AddTableModal: React.FC<AddTableModalProps> = ({ tenantId, isMockMode }) => {
  const { isAddModalOpen, setAddModalOpen } = useTableStore();
  const toast = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<TableFormData>({
    resolver: zodResolver(tableSchema),
    defaultValues: {
      number: 'Table 1',
      seatingCapacity: 4
    }
  });

  const onSubmit = async (data: TableFormData) => {
    try {
      await TableService.createTable(tenantId, data.number, data.seatingCapacity, isMockMode);
      toast.success(`Provisioned ${data.number} with QR token.`);
      setAddModalOpen(false);
      reset();
    } catch (err: any) {
      toast.error(`Failed to add table: ${err.message}`);
    }
  };

  if (!isAddModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm border border-zinc-800 bg-zinc-950 p-6 shadow-2xl rounded-3xl text-white">
        <h3 className="text-lg font-bold mb-4">Provision Dining Table</h3>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-zinc-400 font-semibold uppercase">Table Name / Number</label>
            <input
              {...register('number')}
              className="w-full border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-xs text-zinc-200 rounded-xl focus:outline-none focus:border-emerald-500/30"
              placeholder="e.g. Table 5 or Patio A"
            />
            {errors.number && <p className="text-[10px] text-red-400">{errors.number.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-400 font-semibold uppercase">Seating Capacity</label>
            <input
              type="number"
              {...register('seatingCapacity', { valueAsNumber: true })}
              className="w-full border border-zinc-800 bg-zinc-900 px-3 py-2.5 text-xs text-zinc-200 rounded-xl focus:outline-none focus:border-emerald-500/30"
            />
            {errors.seatingCapacity && <p className="text-[10px] text-red-400">{errors.seatingCapacity.message}</p>}
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
              {isSubmitting ? 'Creating...' : 'Provision Table'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
