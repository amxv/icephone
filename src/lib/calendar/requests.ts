// import { CALENDAR_ITEMS_MOCK, USERS_MOCK } from "@/lib/calendar/mocks"
import { getAppointments as fetchAppointmentsServerAction } from "@/actions/appointmentActions"

export const getEvents = async () => {
	// return CALENDAR_ITEMS_MOCK
	return fetchAppointmentsServerAction()
}

// export const getUsers = async () => {
// 	return USERS_MOCK
// }
