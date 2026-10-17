import HydroApp from "../../components/hydro/hydro-app";
export default async function StationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <HydroApp view="station" initialStation={id}/>;
}
