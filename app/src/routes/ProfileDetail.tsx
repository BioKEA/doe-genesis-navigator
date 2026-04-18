import { useParams } from "react-router-dom";
export default function ProfileDetail() {
  const { slug } = useParams();
  return <div className="p-8">Profile: {slug}</div>;
}
