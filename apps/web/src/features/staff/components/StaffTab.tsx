import React from 'react';
import { Plus, Trash2, UserCheck } from 'lucide-react';
import type { UserProfile } from '@restaurant-qr/core';
import { DataTable, type Column } from '../../../components/shared/DataTable';
import { useStaffStore } from '../../../stores/useStaffStore';
import { useConfirm } from '../../../components/shared/ConfirmContext';
import { useToast } from '../../../components/shared/ToastContext';
import { StaffService } from '../../../services/StaffService';
import { AddStaffModal } from './AddStaffModal';

interface StaffTabProps {
  tenantId: string;
  staff: UserProfile[];
  isMockMode: boolean;
}

export const StaffTab: React.FC<StaffTabProps> = ({ tenantId, staff, isMockMode }) => {
  const { setAddModalOpen } = useStaffStore();
  const { confirm } = useConfirm();
  const toast = useToast();

  const handleDeleteStaff = (member: UserProfile) => {
    confirm({
      title: 'Delete Staff Member?',
      message: `Are you sure you want to remove ${member.displayName} (${member.email})?`,
      confirmText: 'Remove Staff',
      onConfirm: async () => {
        await StaffService.deleteStaffMember(tenantId, member.uid, isMockMode);
        toast.success(`Removed ${member.displayName}.`);
      }
    });
  };

  const columns: Column<UserProfile>[] = [
    {
      header: 'Staff Member',
      accessorKey: 'displayName',
      sortable: true,
      cell: (s) => (
        <div className="flex items-center gap-3">
          <div className="p-2 bg-zinc-800 rounded-xl text-zinc-300">
            <UserCheck className="h-4 w-4" />
          </div>
          <div>
            <div className="font-bold text-white text-xs">{s.displayName}</div>
            <div className="text-[10px] text-zinc-500">{s.email}</div>
          </div>
        </div>
      )
    },
    {
      header: 'Assigned Role',
      accessorKey: 'role',
      sortable: true,
      cell: (s) => (
        <span className="capitalize px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-emerald-400 border border-emerald-500/10">
          {s.role}
        </span>
      )
    },
    {
      header: 'Joined Date',
      cell: (s) => <span className="text-zinc-500 text-xs">{new Date(s.createdAt).toLocaleDateString()}</span>
    },
    {
      header: 'Actions',
      cell: (s) => (
        <div className="flex justify-end">
          <button
            onClick={() => handleDeleteStaff(s)}
            className="p-1.5 border border-zinc-800 hover:border-red-500/30 rounded-lg text-zinc-400 hover:text-red-400"
            title="Remove Staff"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Restaurant Staff Roster</h3>
        <button
          onClick={() => setAddModalOpen(true)}
          className="flex items-center gap-2 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-500/10"
        >
          <Plus className="h-4 w-4" />
          Add Staff Member
        </button>
      </div>

      <DataTable data={staff} columns={columns} searchPlaceholder="Search staff by name or email..." searchField="displayName" />

      <AddStaffModal tenantId={tenantId} isMockMode={isMockMode} />
    </div>
  );
};
