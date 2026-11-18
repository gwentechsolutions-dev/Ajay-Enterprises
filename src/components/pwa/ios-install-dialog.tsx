"use client";

import * as React from "react";
import { Share, PlusSquare, X, Smartphone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePwa } from "./pwa-install-provider";
import { useDriverTranslation } from "@/lib/i18n/driver-portal";

export function IosInstallDialog() {
  const { showIosInstructions, setShowIosInstructions } = usePwa();
  const { t } = useDriverTranslation();

  return (
    <Dialog open={showIosInstructions} onOpenChange={setShowIosInstructions}>
      <DialogContent className="max-w-sm rounded-2xl p-5">
        <DialogHeader className="text-center sm:text-center pb-2">
          <div className="w-12 h-12 rounded-2xl bg-[#0B1E36] text-[#F26522] flex items-center justify-center mx-auto mb-2 shadow-md">
            <Smartphone className="w-6 h-6" />
          </div>
          <DialogTitle className="text-base font-black text-slate-900">
            {t.installAppTitle}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {t.installAppDesc}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2.5 my-2 text-xs">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 font-bold">
              <Share className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-slate-800">{t.iosInstallStep1}</p>
              <p className="text-[11px] text-slate-500">Usually at the bottom of the Safari screen</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="w-8 h-8 rounded-lg bg-orange-100 text-[#F26522] flex items-center justify-center shrink-0 font-bold">
              <PlusSquare className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-slate-800">{t.iosInstallStep2}</p>
              <p className="text-[11px] text-slate-500">Icon will appear on your phone home screen</p>
            </div>
          </div>
        </div>

        <Button
          onClick={() => setShowIosInstructions(false)}
          className="w-full bg-[#0B1E36] hover:bg-[#071424] text-white font-bold h-10 text-xs mt-2"
        >
          Got It
        </Button>
      </DialogContent>
    </Dialog>
  );
}
