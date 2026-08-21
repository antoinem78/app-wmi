// Browser dialer page. Auth lives in the (admin) layout; the token endpoint
// re-checks the session independently.
import { Dialer } from "@/components/Dialer";

export const metadata = { title: "Dial" };

export default function DialPage() {
  return (
    <div className="p-8">
      <h1 className="mb-1 text-2xl font-semibold text-[#0B1F3A]">Dial</h1>
      <p className="mb-6 text-sm text-gray-600">
        Call UK numbers from the browser on the WMI line.
      </p>
      <Dialer />
    </div>
  );
}
