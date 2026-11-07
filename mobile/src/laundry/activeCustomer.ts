/**
 * Which laundry-system customer the signed-in person is, for the older services (wallet, notifications) that read
 * outside React. Set by LaundryBridge. Null for guests and staff.
 */
let activeCustomerId: string | null = null;

export const setActiveCustomer = (id: string | null) => {
  activeCustomerId = id;
};

export const getActiveCustomer = () => activeCustomerId;
