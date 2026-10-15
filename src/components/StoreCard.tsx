import type { Store } from '@/lib/supabase';
import { MapPin, Phone, User, FileText, CheckCircle2, Circle, Clock, Pencil, Trash2 } from 'lucide-react';

type Props = {
  store: Store;
  stopNumber: number;
  confirmed: boolean;
  onToggleConfirm: () => void;
  onEdit: () => void;
  onDelete: () => void;
  showDeliveryConfirmation?: boolean;
  vendorView?: boolean;
};

export function StoreCard({ store, stopNumber, confirmed, onToggleConfirm, onEdit, onDelete, showDeliveryConfirmation = false, vendorView = false }: Props) {
  const fullAddress = [store.address, store.city, store.state, store.zip]
    .filter(Boolean)
    .join(', ');

  return (
    <div
      className={`bg-white rounded-2xl border transition-all ${
        confirmed ? 'border-emerald-300 shadow-sm' : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <div className="p-5">
        <div className="flex items-start gap-3">
          {/* Stop number */}
          <div
            className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
              confirmed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {stopNumber}
          </div>

          {/* Store info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-bold text-slate-900 truncate">{store.name}</h3>
                {fullAddress && (
                  <div className="flex items-start gap-1.5 mt-1 text-sm text-slate-500">
                    <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <span className="truncate">{fullAddress}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={onEdit}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={onDelete}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Contact info */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              {store.phone && (
                <div className="flex items-center gap-1.5 text-sm text-slate-500">
                  <Phone className="w-3.5 h-3.5" />
                  <span>{store.phone}</span>
                </div>
              )}
              {store.contact_name && (
                <div className="flex items-center gap-1.5 text-sm text-slate-500">
                  <User className="w-3.5 h-3.5" />
                  <span>{store.contact_name}</span>
                </div>
              )}
            </div>

            {/* Special instructions */}
            {store.special_instructions && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">
                      Special Instructions
                    </p>
                    <p className="text-sm text-amber-900 whitespace-pre-wrap">
                      {store.special_instructions}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Delivery days */}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                const active = store.delivery_days.includes(day);
                return (
                  <span
                    key={day}
                    className={`text-xs font-medium px-2 py-1 rounded-md ${
                      active
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-50 text-slate-300 border border-slate-100'
                    }`}
                  >
                    {day.slice(0, 3)}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {showDeliveryConfirmation && (
        <button
          onClick={onToggleConfirm}
          className={`w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-colors rounded-b-2xl ${
            confirmed
              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
          }`}
        >
          {confirmed ? (
            <>
              <CheckCircle2 className="w-5 h-5" />
              Delivery Confirmed
            </>
          ) : (
            <>
              <Circle className="w-5 h-5" />
              Mark as Delivered
            </>
          )}
        </button>
      )}
      {vendorView && (
        <div
          className={`w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-b-2xl ${
            confirmed
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-slate-50 text-slate-400'
          }`}
        >
          {confirmed ? (
            <>
              <CheckCircle2 className="w-5 h-5" />
              Delivered by reliever
            </>
          ) : (
            <>
              <Clock className="w-5 h-5" />
              Awaiting reliever delivery
            </>
          )}
        </div>
      )}
    </div>
  );
}
