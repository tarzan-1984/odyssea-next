import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/stores/userStore";
import { getAppHomePath } from "@/utils/roleAccess";

const useGoBack = () => {
	const router = useRouter();
	const currentUser = useCurrentUser();

	const goBack = () => {
		if (window.history.length > 1) {
			router.back(); // Navigate to the previous route
		} else {
			router.push(getAppHomePath(currentUser?.role));
		}
	};

	return goBack;
};

export default useGoBack;
