"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { Mail, MapPin, Phone } from "lucide-react";
import type { SVGProps } from "react";
import { siteConfig } from "../config/siteConfig";

const { phone, whatsapp, email, address, instagram } = siteConfig.contact;

const persianDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
const toPersianDigits = (value: string) =>
  value.replace(/\d/g, (digit) => persianDigits[Number(digit)]);

const currentPersianYear = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  year: "numeric",
}).format(new Date());

function InstagramIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077" />
    </svg>
  );
}

function WhatsappIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

function Footer() {
  return (
    <footer className="relative px-3 pb-6 pt-20 sm:px-6 sm:pb-10 sm:pt-28">
      <div className="relative mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="pointer-events-none absolute z-50 -left-14 -top-10 hidden select-none sm:block sm:h-40 sm:w-40"
        >
          <motion.img
            src="/assets/croissant.png"
            alt=""
            aria-hidden="true"
            className="h-full w-full select-none"
            animate={{
              y: [0, -6, 0],
              rotate: [-16, -13, -16],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="relative mx-auto max-w-6xl overflow-hidden rounded-[2.25rem] border border-white/40 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.5),0_-18px_90px_-40px_rgba(138,84,39,0.2),0_20px_50px_-30px_rgba(138,84,39,0.22)] backdrop-blur-2xl backdrop-saturate-150 sm:rounded-[3rem]"
        >
          <div className="relative grid gap-10 px-6 sm:px-10 sm:py-5 md:grid-cols-2 md:gap-8">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="h-16 w-16 shrink-0 overflow-hidden bg-transparent sm:h-20 sm:w-20">
                  <Image
                    src="/assets/textLogo.png"
                    alt="لوگوی فلوریش"
                    width={160}
                    height={160}
                    className="h-full w-full object-contain"
                  />
                </div>
                <div>
                  <h2 className="font-display font-bold text-cocoa-900 sm:text-xl">
                    فلوریش
                  </h2>
                  <p className="text-xs font-medium text-sand-500 sm:text-sm">
                    بوتیک نان و شیرینی
                  </p>
                </div>
              </div>

              <div className="max-w-sm">
                <p className="text-justify text-sm leading-7 text-cocoa-600 sm:text-[15px]">
                  فلوریش، بوتیک نان و شیرینی مدرن است که با عشق به طعم‌های
                  اصیل و بهترین مواد اولیه، محصولاتی دست‌ساز و تازه می‌آفریند. ما
                  هر روز، لحظه‌های شیرین شما را با دقت و ظرافت می‌سازیم.
                </p>
              </div>

              <div className="mt-1 flex items-center gap-3">
                <a
                  href={instagram}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="اینستاگرام فلوریش"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-sand-400 text-white shadow-[0_10px_20px_-8px_rgba(186,107,38,0.6)] transition-transform hover:scale-105 hover:bg-sand-500 active:scale-95"
                >
                  <InstagramIcon className="h-5 w-5" />
                </a>
                <a
                  href={`https://wa.me/${whatsapp}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="واتس‌اپ فلوریش"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-sand-400 text-white shadow-[0_10px_20px_-8px_rgba(186,107,38,0.6)] transition-transform hover:scale-105 hover:bg-sand-500 active:scale-95"
                >
                  <WhatsappIcon className="h-5 w-5" />
                </a>
              </div>
            </div>

            <div className="flex flex-col gap-5 pt-5">
              <h3 className="font-display text-base font-bold text-cocoa-900 sm:text-lg">
                راه‌های ارتباطی
              </h3>

              <ul className="flex flex-col gap-1 text-sm text-cocoa-600 sm:text-[15px]">
                <li className="flex items-center gap-1">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center text-sand-500">
                    <Phone className="h-4 w-4" strokeWidth={1.9} />
                  </span>
                  <a
                    href={`tel:${phone}`}
                    className="transition-colors hover:text-sand-500"
                  >
                    {toPersianDigits(phone)}
                  </a>
                </li>

                <li className="flex items-center gap-1">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center text-sand-500">
                    <Mail className="h-4 w-4" strokeWidth={1.9} />
                  </span>
                  <a
                    href={`mailto:${email}`}
                    dir="ltr"
                    className="transition-colors hover:text-sand-500"
                  >
                    {email}
                  </a>
                </li>

                <li className="flex items-center gap-1">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center text-sand-500">
                    <MapPin className="h-4 w-4" strokeWidth={1.9} />
                  </span>
                  <span className="max-w-80 leading-6 md:text-right">
                    {address}
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/50 px-6 py-5 sm:px-10">
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
              <p className="text-center text-xs text-cocoa-500 sm:text-right sm:text-sm">
                تمامی حقوق مادی و معنوی، متعلق به بوتیک نان و شیرینی فلوریش است. ©{" "}
                {currentPersianYear}
              </p>
              <a
                referrerPolicy="origin"
                target="_blank"
                href="https://trustseal.enamad.ir/?id=7423133&Code=D18Zie0mygvhVIIgi8e2pcZIH3cTEhSP"
              >
                <img
                  referrerPolicy="origin"
                  src="https://trustseal.enamad.ir/logo.aspx?id=7423133&Code=D18Zie0mygvhVIIgi8e2pcZIH3cTEhSP"
                  alt="نماد اعتماد الکترونیکی"
                  data-code="D18Zie0mygvhVIIgi8e2pcZIH3cTEhSP"
                  className="h-16 w-16 cursor-pointer"
                />
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </footer>
  );
}

export default Footer;
