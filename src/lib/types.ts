import type {
  Dispatch,
  SetStateAction,
  ButtonHTMLAttributes,
  ReactNode,
} from "react";
import type { LucideIcon } from "lucide-react";
export type Setter<T> = Dispatch<SetStateAction<T>>;
export type Role = "Dispatcher" | "Loader" | "Driver" | "Store manager";
export interface Order {
  id: string;
  name: string;
  brand: string;
  district: string;
  amount: string;
  volume: string;
  window: string;
  temp: string;
  status: string;
  eta: string;
  vehicle: string;
  access: string;
  reason?: string;
  proof?: string;
  receiptNote?: string;
}
export interface RouteData {
  id: string;
  name: string;
  vehicle: string;
  driver: string;
  initials: string;
  color: string;
  stops: number;
  done: number;
  eta: string;
  brand: string;
  type: string;
  depot: string;
  weight: number;
  volume: number;
  fuel: number;
  points: string;
}
export interface Activity {
  title: string;
  detail: string;
  time: string;
}
export interface PendingProof {
  id: string;
  proof: string;
}
export interface Persona {
  name: string;
  full: string;
  initials: string;
  title: string;
  email?: string;
  alias?: string;
  seededEmail?: string;
}
export interface ModalState {
  type: string;
  route?: RouteData;
  order?: Order;
}
export interface SharedProps {
  orders: Order[];
  setOrders: Setter<Order[]>;
  loaded: string[];
  setLoaded: Setter<string[]>;
  published: boolean;
  setPublished: Setter<boolean>;
  offline: boolean;
  queued: PendingProof[];
  setQueued: Setter<PendingProof[]>;
  setModal: Setter<ModalState | null>;
  notify: (message: string) => void;
  addEvent: (title: string, detail: string) => void;
  updateOrder: (id: string, values: Partial<Order>) => void;
  sync: () => void;
}
export type ModalProps = SharedProps & { modal: ModalState };
export type RoleProps = Pick<
  SharedProps,
  | "orders"
  | "loaded"
  | "setLoaded"
  | "published"
  | "offline"
  | "queued"
  | "sync"
  | "notify"
  | "setModal"
> & { role: Role; user: Persona; setOffline: Setter<boolean> };
export interface TableProps {
  orders: Order[];
  search: string;
  setSearch: Setter<string>;
  brand: string;
  setBrand: Setter<string>;
  tab: string;
  setTab: Setter<string>;
  setModal: Setter<ModalState | null>;
  download: () => void;
}
export interface MetricProps {
  title: string;
  value: string;
  suffix?: string;
  icon: LucideIcon;
  trend: string;
  color: string;
  bars?: number[];
  onClick?: () => void;
}
export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string;
}
export interface BadgeProps {
  children: ReactNode;
  kind?: string;
}
