import { Link, useParams } from 'react-router-dom';
import MaintenanceWorkOrder from '../components/MaintenanceWorkOrder.jsx';

export default function MaintenanceDetailsPage() {
  const { id } = useParams();

  return (
    <div className="page-enter p-8 space-y-6">
      <Link to="/maintenance" className="btn-ghost py-1.5 px-3 text-xs w-fit">← Back to Maintenance</Link>
      <MaintenanceWorkOrder id={id} />
    </div>
  );
}
