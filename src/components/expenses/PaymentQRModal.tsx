import React, { useState, useEffect } from 'react';
import { X, QrCode, Copy, Check, Trash2 } from 'lucide-react';
import { Profile } from '../../types';
import { appStore } from '../../lib/store';
import { useToast } from '../ui/Toast';
import { FileUpload } from '../ui/FileUpload';
import { getResolvedMediaUrl } from '../../services/storage';

interface PaymentQRModalProps {
  friend: Profile | null;
  onClose: () => void;
}

export const PaymentQRModal: React.FC<PaymentQRModalProps> = ({ friend, onClose }) => {
  const { showToast } = useToast();
  if (!friend) return null;

  const isSelf = friend.id === appStore.currentUser.id;
  const [copied, setCopied] = useState(false);
  const [qrStoragePath, setQrStoragePath] = useState(friend.payment_qr_url || '');
  const [displayQrUrl, setDisplayQrUrl] = useState('');
  const [upiInput, setUpiInput] = useState(friend.upi_id || '');

  useEffect(() => {
    if (friend.payment_qr_url) {
      getResolvedMediaUrl('payment-qr', friend.payment_qr_url).then(url => {
        setDisplayQrUrl(url);
      });
    } else {
      setDisplayQrUrl('');
    }
  }, [friend.payment_qr_url]);

  const handleSaveQR = (e: React.FormEvent) => {
    e.preventDefault();
    appStore.updatePaymentQr(qrStoragePath, upiInput);
    showToast('Saved Payment QR', 'Your friends can now view your UPI QR code to pay.', 'success');
  };

  const handleRemoveQR = () => {
    setQrStoragePath('');
    setDisplayQrUrl('');
    appStore.updatePaymentQr('', upiInput);
    showToast('Removed Payment QR', 'Your payment QR code has been removed.', 'info');
  };

  const handleCopyUPI = () => {
    if (friend.upi_id) {
      navigator.clipboard.writeText(friend.upi_id);
      setCopied(true);
      showToast('Copied UPI ID', friend.upi_id);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 text-slate-100 shadow-2xl relative text-center max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg bg-slate-800/60"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="inline-flex items-center justify-center p-3 bg-emerald-950/80 border border-emerald-800/60 rounded-2xl text-emerald-400 mb-3">
          <QrCode className="w-6 h-6" />
        </div>

        <h3 className="text-base font-bold text-white">Payment Vault QR</h3>
        <p className="text-xs text-slate-400 mt-0.5">{friend.full_name}'s UPI QR Code</p>

        {/* Saved QR Display */}
        <div className="my-5 p-4 bg-white rounded-2xl inline-block shadow-xl border-4 border-slate-800">
          {displayQrUrl ? (
            <img src={displayQrUrl} alt="UPI QR" className="w-48 h-48 object-contain" />
          ) : (
            <div className="w-48 h-48 flex flex-col items-center justify-center text-slate-700 bg-slate-100 rounded-xl p-4">
              <QrCode className="w-12 h-12 opacity-30 mb-2" />
              <p className="text-xs font-semibold text-center">No payment QR uploaded yet</p>
            </div>
          )}
        </div>

        {/* UPI ID Copy Bar */}
        {friend.upi_id && (
          <div className="mb-4 p-2.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
            <span className="font-mono text-emerald-300 font-bold">{friend.upi_id}</span>
            <button
              onClick={handleCopyUPI}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-1 font-semibold"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        )}

        {/* Edit mode for own profile */}
        {isSelf && (
          <form onSubmit={handleSaveQR} className="mt-4 pt-4 border-t border-slate-800 space-y-4 text-left">
            <h4 className="text-xs font-bold text-slate-300">Update Your Payment Details</h4>
            
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">UPI ID (e.g. yourname@okaxis)</label>
              <input
                type="text"
                placeholder="username@upi"
                value={upiInput}
                onChange={e => setUpiInput(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1.5">Upload Payment QR Code</label>
              <FileUpload
                bucket="payment-qr"
                userId={friend.id}
                allowedTypes={['image']}
                initialStoragePath={qrStoragePath}
                label="Choose QR from Gallery / Camera"
                helperText="Upload your Google Pay, PhonePe, or Paytm QR"
                onUploadComplete={(paths) => {
                  if (paths.length > 0) {
                    setQrStoragePath(paths[0]);
                    getResolvedMediaUrl('payment-qr', paths[0]).then(url => setDisplayQrUrl(url));
                  }
                }}
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition-colors"
              >
                Save Payment Details
              </button>

              {friend.payment_qr_url && (
                <button
                  type="button"
                  onClick={handleRemoveQR}
                  className="p-2.5 bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 text-rose-300 rounded-xl transition-colors"
                  title="Delete QR"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
