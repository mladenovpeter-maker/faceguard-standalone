import { useListCameras } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Plus, Video, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function CameraList() {
  const { data: cameras, isLoading } = useListCameras();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Камери</h1>
        <Link href="/cameras/new">
          <Button className="font-mono text-xs uppercase tracking-wider">
            <Plus className="mr-2 h-4 w-4" /> Добави камера
          </Button>
        </Link>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Наименование</TableHead>
              <TableHead>Марка</TableHead>
              <TableHead>Адрес</TableHead>
              <TableHead>Зона</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6}><Skeleton className="h-10 w-full" /></TableCell>
              </TableRow>
            ) : cameras && cameras.length > 0 ? (
              cameras.map(camera => (
                <TableRow key={camera.id}>
                  <TableCell className="font-medium flex items-center gap-2">
                    <Video className="h-4 w-4 text-muted-foreground" />
                    {camera.name}
                  </TableCell>
                  <TableCell>
                    <BrandBadge brand={camera.brand} />
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {camera.protocol}://{camera.host}:{camera.port || 80}
                  </TableCell>
                  <TableCell>{camera.zoneName}</TableCell>
                  <TableCell>
                    <StatusBadge status={camera.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" className="font-mono text-xs h-7">
                      <Network className="h-3 w-3 mr-2" /> ТЕСТ
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Няма конфигурирани камери.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function BrandBadge({ brand }: { brand: string }) {
  const styles: Record<string, string> = {
    dahua: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    hikvision: "bg-red-500/10 text-red-500 border-red-500/20",
    unv: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    other: "bg-muted text-muted-foreground"
  };
  return <Badge variant="outline" className={styles[brand] || styles.other}>{brand.toUpperCase()}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'online') return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">ОНЛАЙН</Badge>;
  if (status === 'offline') return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">ОФЛАЙН</Badge>;
  return <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">НЕИЗВЕСТЕН</Badge>;
}
