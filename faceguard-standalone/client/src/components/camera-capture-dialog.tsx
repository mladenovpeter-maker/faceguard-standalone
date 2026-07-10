import { useState } from "react";
import { useListCameras, useCaptureCameraFrame } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera as CameraIcon, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CameraCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (photoBase64: string) => void;
}

/** Shared dialog for capturing a still frame from one of the configured cameras (e.g. for enrolling an employee's face photo). */
export function CameraCaptureDialog({ open, onOpenChange, onCapture }: CameraCaptureDialogProps) {
  const { data: cameras = [] } = useListCameras({ query: { enabled: open } as any });
  const capture = useCaptureCameraFrame();
  const { toast } = useToast();
  const [cameraId, setCameraId] = useState<string>("");
  const [snapshot, setSnapshot] = useState<string | null>(null);

  function handleCapture() {
    if (!cameraId) return;
    setSnapshot(null);
    capture.mutate({ id: Number(cameraId) }, {
      onSuccess: (result) => setSnapshot(result.snapshotBase64),
      onError: (err: any) => toast({ title: "Грешка при заснемане", description: err.message, variant: "destructive" }),
    });
  }

  function handleUse() {
    if (!snapshot) return;
    const base64 = snapshot.split(",")[1] ?? snapshot;
    onCapture(base64);
    setSnapshot(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) setSnapshot(null); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CameraIcon className="h-4 w-4" /> Заснемане от камера</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Select value={cameraId} onValueChange={setCameraId}>
            <SelectTrigger><SelectValue placeholder="Изберете камера" /></SelectTrigger>
            <SelectContent>
              {cameras.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="w-full h-56 rounded-lg border border-border bg-muted flex items-center justify-center overflow-hidden">
            {snapshot ? (
              <img src={snapshot} alt="Заснет кадър" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs text-muted-foreground text-center px-4">
                {cameraId ? "Натиснете \"Заснеми\" за да направите кадър" : "Изберете камера отгоре"}
              </span>
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleCapture}
            disabled={!cameraId || capture.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${capture.isPending ? "animate-spin" : ""}`} />
            {capture.isPending ? "Заснемане..." : snapshot ? "Заснеми отново" : "Заснеми"}
          </Button>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Отказ</Button>
          <Button type="button" onClick={handleUse} disabled={!snapshot}>Използвай тази снимка</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
