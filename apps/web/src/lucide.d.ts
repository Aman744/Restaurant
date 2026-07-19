declare module 'lucide-react' {
  import React from 'react';
  
  export interface IconProps extends React.SVGProps<SVGSVGElement> {
    size?: number | string;
    absoluteStrokeWidth?: boolean;
  }

  export type Icon = React.ForwardRefExoticComponent<IconProps & React.RefAttributes<SVGSVGElement>>;

  export const ChefHat: Icon;
  export const CreditCard: Icon;
  export const ShieldCheck: Icon;
  export const Store: Icon;
  export const Table: Icon;
  export const UserCheck: Icon;
  export const Utensils: Icon;
  export const Lock: Icon;
  export const Mail: Icon;
  export const Eye: Icon;
  export const EyeOff: Icon;
  export const LayoutDashboard: Icon;
  export const Users: Icon;
  export const Settings: Icon;
  export const Plus: Icon;
  export const Globe: Icon;
  export const FileText: Icon;
  export const Receipt: Icon;
  export const CheckCircle: Icon;
  export const Flame: Icon;
  export const Clock: Icon;
  export const HelpCircle: Icon;
  export const AlertCircle: Icon;
  export const LogOut: Icon;
  export const Menu: Icon;
  export const User: Icon;
  export const Bell: Icon;
  export const Smartphone: Icon;
  export const ShieldAlert: Icon;
  export const ArrowLeft: Icon;
  export const QrCode: Icon;
  export const Download: Icon;
  export const ToggleLeft: Icon;
  export const ToggleRight: Icon;
  export const TrendingUp: Icon;
  export const Database: Icon;
  export const ArrowRight: Icon;
  export const Server: Icon;
  export const Zap: Icon;
  export const Sliders: Icon;
  export const Paintbrush: Icon;
  export const Trash2: Icon;
  export const Power: Icon;
  export const Edit3: Icon;
  export const UserPlus: Icon;
  export const Upload: Icon;
  export const ShoppingBag: Icon;
  export const Minus: Icon;
  export const Sparkles: Icon;
  export const Search: Icon;
  export const Check: Icon;
  export const ChevronRight: Icon;
  export const Heart: Icon;
  export const X: Icon;
}

declare module 'firebase/app';
declare module 'firebase/auth';
declare module 'firebase/firestore';
declare module 'firebase/storage';
declare module 'firebase/functions';

