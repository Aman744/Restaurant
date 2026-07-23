import React, { useState } from 'react';
import { Plus, Trash2, UserCheck, Edit, LayoutGrid, List } from 'lucide-react';
import type { UserProfile } from '@restaurant-qr/core';
import { DataTable, type Column } from '../../../components/shared/DataTable';
import { useStaffStore } from '../../../stores/useStaffStore';
import { useConfirm } from '../../../components/shared/ConfirmContext';
import { useToast } from '../../../components/shared/ToastContext';
import { StaffService } from '../../../services/StaffService';
import { AddStaffModal } from './AddStaffModal';
import { EditStaffModal } from './EditStaffModal';

import { useStaff } from '../../../hooks/useRealtimeData';
import { useUserProfile } from '../../../features/auth/context/UserContext.js';

interface StaffTabProps {
  tenantId: string;
  isMockMode: boolean;
}

export const StaffTab: React.FC<StaffTabProps> = ({ tenantId, isMockMode }) => {
  const { staff, loading } = useStaff(tenantId, isMockMode);
  const { setAddModalOpen } = useStaffStore();
  const { confirm } = useConfirm();
  const toast = useToast();
  const { profile } = useUserProfile();
  const [editingStaff, setEditingStaff] = useState<UserProfile | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  const handleDeleteStaff = (member: UserProfile) => {
    // Security check: Managers cannot delete admins, super-admins, or other managers
    const isManager = profile?.role === 'manager';
    const isTargetProtected = member.role === 'restaurant-admin' || member.role === 'super-admin' || member.role === 'manager';

    if (isManager && isTargetProtected) {
      toast.error('Permission Denied: Managers cannot modify Admin or Super Admin accounts.');
      return;
    }

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
        <span className="capitalize px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-zinc-850 text-emerald-400 border border-emerald-500/10">
          {s.role.replace('-', ' ')}
        </span>
      )
    },
    {
      header: 'Joined Date',
      cell: (s) => {
        const parseDate = (val: any): Date => {
          if (!val) return new Date();
          if (val instanceof Date) return val;
          if (typeof val.toDate === 'function') return val.toDate();
          if (typeof val.seconds === 'number') return new Date(val.seconds * 1000);
          return new Date(val);
        };
        return <span className="text-zinc-500 text-xs">{parseDate(s.createdAt).toLocaleDateString()}</span>;
      }
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (s) => {
        const isManager = profile?.role === 'manager';
        const isTargetProtected = s.role === 'restaurant-admin' || s.role === 'super-admin' || s.role === 'manager';
        
        if (isManager && isTargetProtected) {
          return <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider">Protected</span>;
        }

        return (
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setEditingStaff(s)}
              className="p-1.5 border border-zinc-850 hover:border-emerald-500/30 rounded-xl text-zinc-400 hover:text-emerald-400 transition"
              title="Edit Staff Member"
            >
              <Edit className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => handleDeleteStaff(s)}
              className="p-1.5 border border-zinc-850 hover:border-red-500/30 rounded-xl text-zinc-400 hover:text-red-400 transition"
              title="Remove Staff"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      }
    }
  ];

  const renderStaffGrid = () => {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {staff.map((member) => {
          const isManager = profile?.role === 'manager';
          const isTargetProtected = member.role === 'restaurant-admin' || member.role === 'super-admin' || member.role === 'manager';
          const initials = member.displayName ? member.displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) : 'ST';

          return (
            <div
              key={member.uid}
              className="border border-zinc-900 bg-zinc-950/20 p-5 rounded-3xl space-y-4 flex flex-col justify-between hover:border-zinc-800 transition shadow-xl"
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div className="h-10 w-10 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center font-black text-xs text-emerald-400">
                    {initials}
                  </div>
                  <span className="capitalize px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase bg-zinc-900 border border-emerald-500/10 text-emerald-400">
                    {member.role.replace('-', ' ')}
                  </span>
                </div>

                <div>
                  <h4 className="font-extrabold text-white text-sm truncate">{member.displayName}</h4>
                  <p className="text-[10px] text-zinc-500 truncate font-mono mt-0.5">{member.email}</p>
                </div>
              </div>

              <div className="flex justify-between items-center border-t border-zinc-900/60 pt-3">
                <span className="text-[10px] text-zinc-600 font-mono">
                  Joined {new Date(member.createdAt).toLocaleDateString()}
                </span>
                
                <div className="flex items-center gap-1.5">
                  {isManager && isTargetProtected ? (
                    <span className="text-[9px] text-zinc-605 font-bold uppercase tracking-wider">Protected</span>
                  ) : (
                    <>
                      <button
                        onClick={() => setEditingStaff(member)}
                        className="p-1.5 border border-zinc-850 hover:border-emerald-500/30 rounded-xl text-zinc-400 hover:text-emerald-400 transition"
                        title="Edit Staff Member"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteStaff(member)}
                        className="p-1.5 border border-zinc-850 hover:border-red-500/30 rounded-xl text-zinc-400 hover:text-red-400 transition"
                        title="Remove Staff"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-zinc-400">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"></div>
          <p className="text-xs font-semibold">Loading staff roster...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-900 pb-4">
        <div>
          <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Restaurant Staff Roster</h3>
          <p className="text-xs text-zinc-500 mt-0.5">Manage credentials, permissions, and roles for operations staff</p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto sm:justify-end">
          {/* View Mode Toggle */}
          <div className="flex items-center border border-zinc-900 bg-zinc-950 rounded-xl p-1 shrink-0 select-none">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-zinc-900 text-emerald-400 border border-zinc-800'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-zinc-900 text-emerald-400 border border-zinc-800'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title="List View"
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-2 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-500/10 cursor-pointer transition shrink-0"
          >
            <Plus className="h-4 w-4" />
            Add Staff Member
          </button>
        </div>
      </div>

      {viewMode === 'list' ? (
        <DataTable data={staff} columns={columns} searchPlaceholder="Search staff by name or email..." searchField="displayName" />
      ) : (
        renderStaffGrid()
      )}

      <AddStaffModal tenantId={tenantId} isMockMode={isMockMode} />
      <EditStaffModal tenantId={tenantId} isMockMode={isMockMode} member={editingStaff} onClose={() => setEditingStaff(null)} />
    </div>
  );
};
