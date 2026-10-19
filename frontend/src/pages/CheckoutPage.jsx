import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import SEO from "@/components/common/SEO";
import { AppImage } from "@/components/common/Elements";
import { useCart } from "@/hooks/useCart";
import { useRazorpay } from "@/hooks/useRazorpay";
import { userApi } from "@/api/endpoints/misc";
import { authApi } from "@/api/endpoints/auth";
import { productsApi } from "@/api/endpoints/catalog";
import { ordersApi, paymentsApi, shippingApi, couponsApi } from "@/api/endpoints/orders";
import { formatCurrency } from "@/utils/format";
import { calculateOrderTotals } from "@/utils/pricing";
import { RAZORPAY_KEY_ID } from "@/utils/constants";
import { useSelector } from "react-redux";
import { selectCurrentUser, selectIsAuthenticated } from "@/features/auth/authSlice";
import { getErrorMessage } from "@/api/axiosClient";
import { getBuyNowItem, clearBuyNowItem } from "@/utils/buyNow";
import { guestCartStore } from "@/utils/guestCart";
import OtpModal from "@/components/checkout/OtpModal";
import { Plus, Minus, ShieldCheck, CheckCircle2 } from "lucide-react";

export default function CheckoutPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isBuyNow = searchParams.get("mode") === "buyNow";
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const user = useSelector(selectCurrentUser);
  const { openCheckout } = useRazorpay();

  const [paymentMethod, setPaymentMethod] = useState("razorpay");
  const [placing, setPlacing] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  // OTP verification logs the guest in, which immediately flips
  // `isAuthenticated` — after that, useCart() switches from the guest cart
  // to the (still-empty) account cart. Snapshotting the guest cart's line
  // items the moment "Place Order" is clicked (still pre-auth) means order
  // creation and cart-clearing use the right data regardless of that flip.
  const [guestOrderSnapshot, setGuestOrderSnapshot] = useState(null);

  // ---------------- Buy Now item (bypasses the cart entirely) ----------------
  // Read once — sessionStorage doesn't change during this page's lifetime.
  const [buyNowRef] = useState(() => (isBuyNow ? getBuyNowItem() : null));
  const [buyNowQty, setBuyNowQty] = useState(buyNowRef?.quantity || 1);
  const { data: buyNowProductData } = useQuery({
    queryKey: ["buy-now-product", buyNowRef?.productId],
    queryFn: () => productsApi.getById(buyNowRef.productId),
    enabled: isBuyNow && !!buyNowRef,
  });
  const buyNowProduct = buyNowProductData?.product;
  const buyNowVariant = (buyNowProduct?.variants || []).find((v) => v._id === buyNowRef?.variantId);

  useEffect(() => {
    if (isBuyNow && !buyNowRef) {
      toast.error("No product selected — redirected to shop");
      navigate("/shop");
    }
  }, [isBuyNow, buyNowRef, navigate]);

  // ---------------- Regular account cart (unused in Buy Now mode) ----------------
  const { items: cartItems, subTotal: cartSubTotal, appliedCoupon: cartCoupon, applyCoupon: applyCartCoupon, removeCoupon: removeCartCoupon, isApplyingCoupon: isApplyingCartCoupon, clearCart } = useCart();

  const buyNowPrice = buyNowVariant
    ? (buyNowVariant.salePrice > 0 ? buyNowVariant.salePrice : buyNowVariant.price)
    : buyNowProduct
      ? (buyNowProduct.salePrice > 0 ? buyNowProduct.salePrice : buyNowProduct.price)
      : 0;
  const buyNowStock = buyNowVariant ? buyNowVariant.stock : buyNowProduct?.stock || 0;

  const displayItems = isBuyNow
    ? (buyNowProduct ? [{ product: buyNowProduct, quantity: buyNowQty, itemTotal: buyNowPrice * buyNowQty }] : [])
    : cartItems;
  const subTotal = isBuyNow ? buyNowPrice * buyNowQty : cartSubTotal;

  // ---------------- Coupon ----------------
  // Buy Now never touches the account cart, so it always uses the guest-safe
  // validate-by-subtotal endpoint (works the same whether logged in or not);
  // the normal cart flow keeps using the existing cart-bound coupon (shared
  // with CartPage via Redux, so it stays in sync coming from there).
  const [couponInput, setCouponInput] = useState("");
  const [directCoupon, setDirectCoupon] = useState(null);
  const [applyingDirectCoupon, setApplyingDirectCoupon] = useState(false);

  const appliedCoupon = isBuyNow ? directCoupon : cartCoupon;
  const discountAmount = appliedCoupon?.discountAmount || 0;

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    if (isBuyNow) {
      setApplyingDirectCoupon(true);
      try {
        const res = await couponsApi.validate({ code: couponInput.trim(), subtotal: subTotal });
        setDirectCoupon({ code: res.code, discountAmount: res.discountAmount });
        toast.success(`Coupon "${res.code}" applied`);
        setCouponInput("");
      } catch (err) {
        toast.error(getErrorMessage(err));
      } finally {
        setApplyingDirectCoupon(false);
      }
    } else {
      try {
        await applyCartCoupon(couponInput.trim());
        setCouponInput("");
      } catch (err) {
        toast.error(getErrorMessage(err));
      }
    }
  };
  const handleRemoveCoupon = () => (isBuyNow ? setDirectCoupon(null) : removeCartCoupon());

  // ---------------- Address: account (logged in) vs guest form ----------------
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [showNewAddress, setShowNewAddress] = useState(false);

  const { data: addressData } = useQuery({
    queryKey: ["addresses"],
    queryFn: userApi.getAddresses,
    enabled: isAuthenticated,
  });
  const addresses = addressData?.addresses || [];

  useEffect(() => {
    if (!selectedAddressId && addresses.length > 0) {
      const def = addresses.find((a) => a.isDefault) || addresses[0];
      setSelectedAddressId(def._id);
    }
  }, [addresses, selectedAddressId]);

  const { register, handleSubmit, reset, formState: { errors } } = useForm();
  const addAddressMutation = useMutation({
    mutationFn: userApi.addAddress,
    onSuccess: (data) => {
      toast.success("Address added");
      setShowNewAddress(false);
      reset();
      const newest = data.addresses[data.addresses.length - 1];
      setSelectedAddressId(newest._id);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  // Guest contact + address
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [mobileStatus, setMobileStatus] = useState(null); // null | 'checking' | 'existing' | 'new'
  const [guestAddress, setGuestAddress] = useState({
    fullName: "", addressLine1: "", addressLine2: "", city: "", state: "", pincode: "", country: "India",
  });
  const [saveAddress, setSaveAddress] = useState(true);

  useEffect(() => {
    if (isAuthenticated) return;
    if (!/^[0-9]{10}$/.test(mobile)) {
      setMobileStatus(null);
      return;
    }
    setMobileStatus("checking");
    const timer = setTimeout(async () => {
      try {
        const res = await authApi.checkMobile({ mobile });
        setMobileStatus(res.exists ? "existing" : "new");
        // Returning customer — auto-fill from their saved profile/address
        // (still fully editable below; any edit gets saved back to their
        // account once OTP verification succeeds, see handleOtpVerified).
        // A brand-new number just leaves the form blank for manual entry.
        if (res.exists && res.profile) {
          if (res.profile.email) setEmail(res.profile.email);
          if (res.profile.address) {
            setGuestAddress((prev) => ({ ...prev, ...res.profile.address }));
          } else if (res.profile.name) {
            setGuestAddress((prev) => ({ ...prev, fullName: res.profile.name }));
          }
        }
      } catch {
        setMobileStatus(null);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [mobile, isAuthenticated]);

  // ---------------- Shipping ----------------
  const [shipping, setShipping] = useState(null);
  const selectedAccountAddress = addresses.find((a) => a._id === selectedAddressId);
  const activePincode = isAuthenticated ? selectedAccountAddress?.pincode : guestAddress.pincode;

  useEffect(() => {
    if (activePincode && /^[0-9]{6}$/.test(activePincode)) {
      shippingApi
        .calculate({ pincode: activePincode, cod: paymentMethod === "cod" })
        .then(setShipping)
        .catch(() => setShipping(null));
    }
  }, [activePincode, paymentMethod]);

  const { tax, grandTotal } = calculateOrderTotals(subTotal, discountAmount, shipping?.shippingCharge || 0);

  // ---------------- Place order ----------------
  const buildShippingAddress = () => {
    if (isAuthenticated) {
      const address = selectedAccountAddress;
      if (!address) return null;
      return {
        fullName: user?.name || "",
        email: user?.email || undefined,
        mobile: user?.mobile,
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2,
        city: address.city,
        state: address.state,
        country: address.country,
        pincode: address.pincode,
      };
    }
    const { fullName, addressLine1, addressLine2, city, state, pincode, country } = guestAddress;
    if (!fullName || !addressLine1 || !city || !state || !pincode) return null;
    return { fullName, email, mobile, addressLine1, addressLine2, city, state, country, pincode };
  };

  const buildOrderPayload = () => {
    const shippingAddress = buildShippingAddress();
    const payload = {
      shippingAddress,
      paymentMethod,
      couponCode: appliedCoupon?.code || undefined,
    };
    if (isBuyNow) {
      payload.items = [{ productId: buyNowRef.productId, variantId: buyNowRef.variantId || undefined, quantity: buyNowQty }];
    } else if (guestOrderSnapshot) {
      payload.items = guestOrderSnapshot;
    }
    return payload;
  };

  const runCreateOrder = async () => {
    setPlacing(true);
    try {
      const result = await ordersApi.create(buildOrderPayload());

      const clearWhicheverCart = async () => {
        if (isBuyNow) {
          clearBuyNowItem();
        } else if (guestOrderSnapshot) {
          // The account cart (now that OTP login has happened) is a
          // separate, still-empty thing — the guest cart in localStorage is
          // what actually needs clearing.
          guestCartStore.clear();
        } else {
          await clearCart();
        }
      };

      if (paymentMethod === "cod") {
        await clearWhicheverCart();
        toast.success("Order placed successfully!");
        navigate(`/account/orders/${result.order._id}?success=1`);
        return;
      }

      await openCheckout({
        key: result.razorpayKeyId || RAZORPAY_KEY_ID,
        amount: result.razorpayOrder.amount,
        currency: result.razorpayOrder.currency,
        order_id: result.razorpayOrder.id,
        name: "Astro Sanatan Shakti",
        description: `Order ${result.order.orderNumber}`,
        prefill: { name: user?.name, email: user?.email || email, contact: user?.mobile || mobile },
        theme: { color: "#7A1F2B" },
        handler: async (response) => {
          try {
            await paymentsApi.verify({
              orderId: result.order._id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            await clearWhicheverCart();
            toast.success("Payment successful! Order confirmed.");
            navigate(`/account/orders/${result.order._id}?success=1`);
          } catch (err) {
            toast.error(getErrorMessage(err));
            navigate(`/account/orders/${result.order._id}`);
          }
        },
        modal: {
          ondismiss: async () => {
            await paymentsApi.cancelled({ orderId: result.order._id }).catch(() => {});
            toast.error("Payment cancelled");
          },
        },
      });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setPlacing(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!isBuyNow && cartItems.length === 0) return toast.error("Your cart is empty");
    const address = buildShippingAddress();
    if (!address) return toast.error(isAuthenticated ? "Please select a shipping address" : "Please fill in your name and address");
    if (!isAuthenticated && !/^[0-9]{10}$/.test(mobile)) return toast.error("Enter a valid 10-digit mobile number");
    if (!isAuthenticated && !email) return toast.error("Please enter your email address");
    if (isBuyNow && buyNowQty > buyNowStock) return toast.error(`Only ${buyNowStock} unit(s) in stock`);

    if (isAuthenticated) {
      await runCreateOrder();
    } else {
      // Snapshot now, while `cartItems` still reflects the guest cart (this
      // is the last moment before OTP verification flips isAuthenticated).
      if (!isBuyNow) {
        setGuestOrderSnapshot(
          cartItems.map((item) => ({
            productId: item.product._id,
            variantId: item.variant?._id || undefined,
            quantity: item.quantity,
            color: item.color,
            size: item.size,
          })),
        );
      }
      setShowOtp(true);
    }
  };

  const handleOtpVerified = async () => {
    setShowOtp(false);
    await runCreateOrder();
  };

  return (
    <>
      <SEO title="Checkout" noindex />
      <div className="container-page py-10">
        <h1 className="mb-8 font-display text-3xl">Checkout</h1>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_380px]">
          <div className="space-y-8">
            {!isAuthenticated && (
              <section>
                <h2 className="mb-4 font-display text-xl">1. Contact</h2>
                <div className="card grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email Address"
                    className="input-field"
                  />
                  <div>
                    <input
                      type="tel"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      placeholder="Mobile Number"
                      className="input-field"
                    />
                    {mobileStatus === "existing" && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-green-700"><CheckCircle2 size={12} /> Welcome back! We've filled in your saved details below — feel free to edit them.</p>
                    )}
                    {mobileStatus === "new" && (
                      <p className="mt-1 text-xs text-night-900/50">New here? We'll create your account after verification.</p>
                    )}
                  </div>
                </div>
              </section>
            )}

            <section>
              <h2 className="mb-4 font-display text-xl">{isAuthenticated ? "1." : "2."} Shipping Address</h2>
              {isAuthenticated ? (
                <div className="space-y-3">
                  {addresses.map((addr) => (
                    <label key={addr._id} className="card flex cursor-pointer items-start gap-3 p-4">
                      <input
                        type="radio"
                        checked={selectedAddressId === addr._id}
                        onChange={() => setSelectedAddressId(addr._id)}
                        className="mt-1"
                      />
                      <div className="text-sm">
                        <p className="font-medium">{addr.type}</p>
                        <p className="text-night-900/60">
                          {addr.addressLine1}, {addr.addressLine2} {addr.city}, {addr.state} {addr.pincode}
                        </p>
                      </div>
                    </label>
                  ))}
                  <button onClick={() => setShowNewAddress((v) => !v)} className="flex items-center gap-2 text-sm text-gold-600">
                    <Plus size={15} /> Add New Address
                  </button>
                  {showNewAddress && (
                    <form
                      onSubmit={handleSubmit((vals) => addAddressMutation.mutate(vals))}
                      className="card grid grid-cols-1 gap-3 p-4 sm:grid-cols-2"
                    >
                      <select {...register("type")} className="input-field sm:col-span-2">
                        <option value="Home">Home</option>
                        <option value="Office">Office</option>
                        <option value="Other">Other</option>
                      </select>
                      <input {...register("addressLine1", { required: true })} placeholder="Address Line 1" className="input-field sm:col-span-2" />
                      <input {...register("addressLine2")} placeholder="Address Line 2 (optional)" className="input-field sm:col-span-2" />
                      <input {...register("city", { required: true })} placeholder="City" className="input-field" />
                      <input {...register("state", { required: true })} placeholder="State" className="input-field" />
                      <input {...register("pincode", { required: true })} placeholder="Pincode" className="input-field" />
                      <input {...register("country")} defaultValue="India" placeholder="Country" className="input-field" />
                      {errors && Object.keys(errors).length > 0 && (
                        <p className="field-error sm:col-span-2">Please fill all required fields</p>
                      )}
                      <button type="submit" className="btn-primary sm:col-span-2">Save Address</button>
                    </form>
                  )}
                </div>
              ) : (
                <div className="card grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
                  <input value={guestAddress.fullName} onChange={(e) => setGuestAddress({ ...guestAddress, fullName: e.target.value })} placeholder="Full Name" className="input-field sm:col-span-2" />
                  <input value={guestAddress.addressLine1} onChange={(e) => setGuestAddress({ ...guestAddress, addressLine1: e.target.value })} placeholder="Address Line 1" className="input-field sm:col-span-2" />
                  <input value={guestAddress.addressLine2} onChange={(e) => setGuestAddress({ ...guestAddress, addressLine2: e.target.value })} placeholder="Address Line 2 (optional)" className="input-field sm:col-span-2" />
                  <input value={guestAddress.city} onChange={(e) => setGuestAddress({ ...guestAddress, city: e.target.value })} placeholder="City" className="input-field" />
                  <input value={guestAddress.state} onChange={(e) => setGuestAddress({ ...guestAddress, state: e.target.value })} placeholder="State" className="input-field" />
                  <input value={guestAddress.pincode} onChange={(e) => setGuestAddress({ ...guestAddress, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })} placeholder="Pincode" className="input-field" />
                  <input value={guestAddress.country} onChange={(e) => setGuestAddress({ ...guestAddress, country: e.target.value })} placeholder="Country" className="input-field" />
                  <label className="flex items-center gap-2 text-sm sm:col-span-2">
                    <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} /> Save this address for future
                  </label>
                </div>
              )}
            </section>

            <section>
              <h2 className="mb-4 font-display text-xl">{isAuthenticated ? "2." : "3."} Payment Method</h2>
              <div className="space-y-3">
                <label className="card flex cursor-pointer items-center gap-3 p-4">
                  <input type="radio" checked={paymentMethod === "razorpay"} onChange={() => setPaymentMethod("razorpay")} />
                  <span className="text-sm">Pay Online (Cards / UPI / Netbanking — Razorpay)</span>
                </label>
                <label className="card flex cursor-pointer items-center gap-3 p-4">
                  <input type="radio" checked={paymentMethod === "cod"} onChange={() => setPaymentMethod("cod")} />
                  <span className="text-sm">Cash on Delivery</span>
                </label>
              </div>
            </section>
          </div>

          <div className="card h-fit space-y-3 p-6 lg:sticky lg:top-6">
            <h2 className="font-display text-xl">Order Summary</h2>

            {isBuyNow ? (
              displayItems.map((item) => (
                <div key={item.product._id} className="flex items-center gap-3 text-sm">
                  {item.product.thumbnail?.url && (
                    <AppImage src={item.product.thumbnail.url} alt={item.product.title} className="h-14 w-14 rounded-sm object-cover" />
                  )}
                  <div className="flex-1">
                    <p className="text-night-900/80">{item.product.title}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <button onClick={() => setBuyNowQty((q) => Math.max(1, q - 1))} className="rounded border border-night-900/15 p-1"><Minus size={12} /></button>
                      <span className="w-6 text-center text-xs">{buyNowQty}</span>
                      <button onClick={() => setBuyNowQty((q) => Math.min(buyNowStock, q + 1))} className="rounded border border-night-900/15 p-1"><Plus size={12} /></button>
                    </div>
                  </div>
                  <span>{formatCurrency(item.itemTotal)}</span>
                </div>
              ))
            ) : (
              displayItems.map((item) => (
                <div key={item.product._id} className="flex justify-between text-sm">
                  <span className="text-night-900/70">{item.product.title} × {item.quantity}</span>
                  <span>{formatCurrency(item.itemTotal)}</span>
                </div>
              ))
            )}

            {appliedCoupon ? (
              <div className="flex items-center justify-between rounded-sm bg-green-50 px-3 py-2 text-sm text-green-700">
                <span>Coupon <strong>{appliedCoupon.code}</strong> applied</span>
                <button onClick={handleRemoveCoupon} className="text-xs underline">Remove</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder="Coupon code"
                  className="input-field"
                  onKeyDown={(e) => e.key === "Enter" && handleApplyCoupon()}
                />
                <button onClick={handleApplyCoupon} disabled={isApplyingCartCoupon || applyingDirectCoupon} className="btn-outline shrink-0">
                  Apply
                </button>
              </div>
            )}

            <div className="border-t border-night-900/10 pt-3">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>{formatCurrency(subTotal)}</span>
              </div>
              {appliedCoupon && (
                <div className="flex justify-between text-sm text-green-700">
                  <span>Coupon Discount ({appliedCoupon.code})</span>
                  <span>− {formatCurrency(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span>Shipping</span>
                <span>{shipping ? formatCurrency(shipping.shippingCharge) : "—"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>GST</span>
                <span>{formatCurrency(tax)}</span>
              </div>
              <div className="mt-2 flex justify-between font-display text-lg font-semibold">
                <span>Total</span>
                <span>{formatCurrency(grandTotal)}</span>
              </div>
            </div>

            <button onClick={handlePlaceOrder} disabled={placing} className="btn-primary w-full">
              {placing ? "Processing..." : "Place Order"}
            </button>
            <p className="flex items-center justify-center gap-1.5 text-xs text-night-900/40">
              <ShieldCheck size={13} /> Secure checkout
            </p>
          </div>
        </div>
      </div>

      {showOtp && (
        <OtpModal
          mobile={mobile}
          extraPayload={{
            name: guestAddress.fullName,
            email,
            address: saveAddress
              ? {
                  type: "Home",
                  addressLine1: guestAddress.addressLine1,
                  addressLine2: guestAddress.addressLine2,
                  city: guestAddress.city,
                  state: guestAddress.state,
                  country: guestAddress.country,
                  pincode: guestAddress.pincode,
                }
              : undefined,
            saveAddress,
          }}
          onVerified={handleOtpVerified}
          onClose={() => setShowOtp(false)}
        />
      )}
    </>
  );
}
