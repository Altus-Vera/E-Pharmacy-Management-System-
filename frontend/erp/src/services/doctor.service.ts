import api from "./api";
import type { Doctor, DoctorCreate } from "../types";

// API field names: slmc_reg_no, hospital  →  UI names: slmc_reg_number, hospital_clinic
type ApiDoctor = Omit<Doctor, "slmc_reg_number" | "hospital_clinic"> & { slmc_reg_no: string | null; hospital: string | null };

const fromApi = (d: ApiDoctor): Doctor => ({ ...d, slmc_reg_number: d.slmc_reg_no ?? "", hospital_clinic: d.hospital });
const toApi = (d: Partial<DoctorCreate> & { is_active?: boolean }) => {
  const { slmc_reg_number, hospital_clinic, ...rest } = d;
  return { ...rest, slmc_reg_no: slmc_reg_number, hospital: hospital_clinic };
};

export const doctorService = {
  async getAll(): Promise<Doctor[]> {
    return (await api.get<ApiDoctor[]>("/doctors")).data.map(fromApi);
  },
  /** Search by name, SLMC registration number or phone. */
  async search(q: string): Promise<Doctor[]> {
    return (await api.get<ApiDoctor[]>("/doctors", { params: { search: q } })).data.map(fromApi);
  },
  async create(data: DoctorCreate): Promise<Doctor> {
    return fromApi((await api.post<ApiDoctor>("/doctors", toApi(data))).data);
  },
  async update(id: number, data: Partial<DoctorCreate> & { is_active?: boolean }): Promise<Doctor> {
    return fromApi((await api.patch<ApiDoctor>(`/doctors/${id}`, toApi(data))).data);
  },
};
