import { notFound } from "next/navigation";
import HydroApp from "../../components/hydro/hydro-app";
import { HYDRO_BASINS } from "../../lib/hydro/model";
export default async function BasinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!HYDRO_BASINS.some(basin => basin.id === id)) notFound();
  return <HydroApp view="basin" initialBasin={id}/>;
}
