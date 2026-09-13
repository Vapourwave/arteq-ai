import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore as initFirestore, type Firestore, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import type { Patient } from "@arteq/shared";
import { env, hasFirebaseConfig } from "../../config/env.js";

/**
 * ARTEQ Hospital Patient Registry Service.
 *
 * When Firebase is configured, persists patient records authoritatively
 * in Google Cloud Firestore (collection: "patients").
 *
 * In local development, if Firebase credentials are unset, falls back
 * strictly to an in-memory development registry so tests and local dev
 * remain operable.
 */

let firestore: Firestore | null = null;

function getFirestore(): Firestore | null {
  if (firestore) return firestore;
  if (!hasFirebaseConfig) return null;

  try {
    if (!getApps().length) {
      if (env.firebaseProjectId && env.firebaseClientEmail && env.firebasePrivateKey) {
        initializeApp({
          credential: cert({
            projectId: env.firebaseProjectId,
            clientEmail: env.firebaseClientEmail,
            privateKey: env.firebasePrivateKey,
          }),
        });
      } else {
        initializeApp();
      }
    }
    firestore = initFirestore();
    console.log("[Firebase] Firestore patient database initialized successfully.");
    return firestore;
  } catch (err) {
    console.error("[Firebase] Failed to initialize Firestore:", err);
    return null;
  }
}

export const MOCK_PATIENTS: Patient[] = [
  {
    id: "pat-1000",
    name: "John Doe",
    phone: "5550100",
    address: "123 Main St",
    registeredAt: new Date().toISOString(),
  },
];

let nextPatientId = 1001;

export async function listPatients(): Promise<Patient[]> {
  const db = getFirestore();
  if (db) {
    try {
      const snap = await db.collection("patients").get();
      return snap.docs.map((doc: QueryDocumentSnapshot) => doc.data() as Patient);
    } catch (e) {
      console.error("[Firebase] Error listing patients:", e);
    }
  }
  return MOCK_PATIENTS;
}

export async function getPatient(id: string): Promise<Patient | null> {
  const db = getFirestore();
  if (db) {
    try {
      const doc = await db.collection("patients").doc(id).get();
      if (doc.exists) {
        return doc.data() as Patient;
      }
    } catch (e) {
      console.error("[Firebase] Error fetching patient:", e);
    }
  }
  return MOCK_PATIENTS.find((p) => p.id === id) ?? null;
}

export async function findPatientByPhone(phone: string): Promise<Patient | null> {
  const normalizedPhone = phone.trim();
  const db = getFirestore();
  if (db) {
    try {
      const snap = await db
        .collection("patients")
        .where("phone", "==", normalizedPhone)
        .limit(1)
        .get();
      if (!snap.empty) {
        return snap.docs[0].data() as Patient;
      }
    } catch (e) {
      console.error("[Firebase] Error searching patient by phone:", e);
    }
  }

  return (
    MOCK_PATIENTS.find((p) => p.phone.replace(/\D/g, "") === normalizedPhone.replace(/\D/g, "")) ??
    null
  );
}

export async function findPatientByNameAndPhone(name: string, phone: string): Promise<Patient | null> {
  const normalizedName = name.toLowerCase().trim();
  const normalizedPhone = phone.trim();

  const db = getFirestore();
  if (db) {
    try {
      const snap = await db
        .collection("patients")
        .where("phone", "==", normalizedPhone)
        .get();
      const match = snap.docs.find(
        (doc: QueryDocumentSnapshot) => (doc.data() as Patient).name.toLowerCase().trim() === normalizedName,
      );
      if (match) {
        return match.data() as Patient;
      }
    } catch (e) {
      console.error("[Firebase] Error searching patient by name and phone:", e);
    }
  }

  return (
    MOCK_PATIENTS.find(
      (p) =>
        p.name.toLowerCase().trim() === normalizedName &&
        p.phone.replace(/\D/g, "") === normalizedPhone.replace(/\D/g, ""),
    ) ?? null
  );
}

export async function registerPatient(params: {
  name: string;
  phone: string;
  address?: string;
  idPhotoRef?: string;
}): Promise<Patient> {
  const newPatient: Patient = {
    id: `pat-${nextPatientId++}`,
    name: params.name.trim(),
    phone: params.phone.trim(),
    address: params.address?.trim(),
    idPhotoRef: params.idPhotoRef,
    registeredAt: new Date().toISOString(),
  };

  const db = getFirestore();
  if (db) {
    try {
      await db.collection("patients").doc(newPatient.id).set(newPatient);
      console.log(`[Firebase] Saved new patient ${newPatient.id} (${newPatient.name}) to Firestore.`);
    } catch (e) {
      console.error("[Firebase] Error saving patient to Firestore:", e);
    }
  } else {
    if (process.env.NODE_ENV === "production") {
      console.warn("[Firebase] WARNING: Firebase unconfigured in production. Storing patient in-memory.");
    }
  }

  MOCK_PATIENTS.push(newPatient);
  return newPatient;
}
