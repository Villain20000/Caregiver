/**
 * packages/fhir-types/src/base.ts
 *
 * FHIR R4 base types — the foundational building blocks shared by all
 * resource definitions. These are NOT full FHIR datatypes (the spec has
 * hundreds); we include only the subset used by the Caregiver platform's
 * 12 curated resources.
 *
 * @see https://hl7.org/fhir/R4/datatypes.html — FHIR R4 datatypes reference
 */

// ══════════════════════════════════════════════════════════════
// PRIMITIVE TYPES
// ══════════════════════════════════════════════════════════════

/** FHIR `id` — lowercase alphanumeric + '-' + '.', max 64 chars. */
export type FhirId = string;

/** FHIR `uri` — absolute URL. */
export type FhirUri = string;

/** FHIR `instant` — ISO 8601 timestamp with timezone (YYYY-MM-DDThh:mm:ss.sssZ). */
export type FhirInstant = string;

/** FHIR `dateTime` — ISO 8601 date or date-time (partial precision allowed). */
export type FhirDateTime = string;

/** FHIR `date` — ISO 8601 date (YYYY-MM-DD). */
export type FhirDate = string;

/** FHIR `code` — a string from a defined value set (whitespace-trimmed). */
export type FhirCode = string;

/** FHIR `string` — sequence of Unicode characters. */
export type FhirString = string;

/** FHIR `boolean`. */
export type FhirBoolean = boolean;

/** FHIR `integer`. */
export type FhirInteger = number;

/** FHIR `positiveInt` — integer > 0. */
export type FhirPositiveInt = number;

/** FHIR `decimal` — decimal number (used for measurements). */
export type FhirDecimal = number;

// ══════════════════════════════════════════════════════════════
// METADATA & EXTENSIONS
// ══════════════════════════════════════════════════════════════

/**
 * FHIR `Meta` — metadata about a resource: version, last update, profiles,
 * security tags, and tags. Embedded in every resource under `meta`.
 */
export interface Meta {
  /** Version-specific identifier (changes on each update). */
  versionId?: FhirId;
  /** When the resource version was last updated. */
  lastUpdated?: FhirInstant;
  /** Profiles this resource claims to conform to (URI references). */
  profile?: FhirUri[];
  /** Security labels applied to the resource (for access control). */
  security?: Coding[];
  /** Tags applied to the resource (user-defined categories). */
  tag?: Coding[];
}

/**
 * FHIR `Extension` — a key-value extension for adding non-standard fields.
 * Used for profile-specific data not in the base FHIR spec.
 */
export interface Extension {
  /** URL identifying the extension definition. */
  url: FhirUri;
  /** Value of the extension (any FHIR datatype). */
  valueString?: FhirString;
  valueBoolean?: FhirBoolean;
  valueInteger?: FhirInteger;
  valueDecimal?: FhirDecimal;
  valueDateTime?: FhirDateTime;
  valueCode?: FhirCode;
}

// ══════════════════════════════════════════════════════════════
// DATATYPE: Coding & CodeableConcept
// ══════════════════════════════════════════════════════════════

/**
 * FHIR `Coding` — a reference to a code defined by a terminology system.
 * Example: { system: 'http://loinc.org', code: '8867-4', display: 'Heart rate' }
 */
export interface Coding {
  /** Identity of the terminology system (URI). */
  system?: FhirUri;
  /** Version of the system (if relevant). */
  version?: FhirString;
  /** Symbol in syntax defined by the system. */
  code?: FhirCode;
  /** Human-readable representation of the code. */
  display?: FhirString;
  /** Whether this coding was chosen by the user (vs. system-assigned). */
  userSelected?: FhirBoolean;
}

/**
 * FHIR `CodeableConcept` — a coded value with optional text representation.
 * Can include multiple codings from different terminology systems.
 */
export interface CodeableConcept {
  /** Coded representations of the concept. */
  coding?: Coding[];
  /** Plain text representation of the concept (no coding). */
  text?: FhirString;
}

// ══════════════════════════════════════════════════════════════
// DATATYPE: Identifier
// ══════════════════════════════════════════════════════════════

/**
 * FHIR `Identifier` — an identifier intended for computation/comparison.
 * Example: MRN (Medical Record Number), SSN, driver's license.
 */
export interface Identifier {
  /** What namespace the identifier is valid in (URI). */
  system?: FhirUri;
  /** The identifier value itself. */
  value?: FhirString;
  /** How/where the identifier is used (e.g. 'usual', 'official', 'temp'). */
  use?: 'usual' | 'official' | 'temp' | 'secondary' | 'old';
  /** What kind of identifier this is (e.g. MRN, SSN). */
  type?: CodeableConcept;
  /** Organization that issued the identifier. */
  assigner?: Reference;
  /** Time period when the identifier was valid. */
  period?: Period;
}

// ══════════════════════════════════════════════════════════════
// DATATYPE: HumanName
// ══════════════════════════════════════════════════════════════

/**
 * FHIR `HumanName` — a person's name with support for given, family, prefix,
 * suffix, and text representations.
 */
export interface HumanName {
  /** How this name should be used (usual, official, nickname, etc.). */
  use?: 'usual' | 'official' | 'temp' | 'nickname' | 'anonymous' | 'old' | 'maiden';
  /** Text representation of the full name. */
  text?: FhirString;
  /** Family name (surname). */
  family?: FhirString;
  /** Given names (first name, middle names). */
  given?: FhirString[];
  /** Name prefixes (Dr., Mr., Mrs.). */
  prefix?: FhirString[];
  /** Name suffixes (Jr., III, PhD). */
  suffix?: FhirString[];
  /** Time period when this name was in use. */
  period?: Period;
}

// ══════════════════════════════════════════════════════════════
// DATATYPE: ContactPoint
// ══════════════════════════════════════════════════════════════

/**
 * FHIR `ContactPoint` — a contact detail (phone, email, fax, etc.).
 */
export interface ContactPoint {
  /** Type of contact point. */
  system?: 'phone' | 'fax' | 'email' | 'pager' | 'url' | 'sms' | 'other';
  /** The actual contact value (phone number, email address, etc.). */
  value?: FhirString;
  /** How this contact should be used (home, work, mobile, etc.). */
  use?: 'home' | 'work' | 'temp' | 'old' | 'mobile';
  /** Ranking of this contact (0 = highest priority). */
  rank?: FhirPositiveInt;
  /** Time period when this contact was valid. */
  period?: Period;
}

// ══════════════════════════════════════════════════════════════
// DATATYPE: Address
// ══════════════════════════════════════════════════════════════

/**
 * FHIR `Address` — a physical or mailing address.
 */
export interface Address {
  /** How this address should be used (home, work, temp, etc.). */
  use?: 'home' | 'work' | 'temp' | 'old' | 'billing';
  /** Type of address (postal, physical, both). */
  type?: 'postal' | 'physical' | 'both';
  /** Text representation of the full address. */
  text?: FhirString;
  /** Street address lines. */
  line?: FhirString[];
  /** City, town, or municipality. */
  city?: FhirString;
  /** District/county. */
  district?: FhirString;
  /** State, province, or region. */
  state?: FhirString;
  /** Postal/ZIP code. */
  postalCode?: FhirString;
  /** Country. */
  country?: FhirString;
  /** Time period when this address was valid. */
  period?: Period;
}

// ══════════════════════════════════════════════════════════════
// DATATYPE: Period
// ══════════════════════════════════════════════════════════════

/**
 * FHIR `Period` — a time range defined by a start and/or end date.
 */
export interface Period {
  /** Start of the period (inclusive). */
  start?: FhirDateTime;
  /** End of the period (inclusive; if missing, period is ongoing). */
  end?: FhirDateTime;
}

// ══════════════════════════════════════════════════════════════
// DATATYPE: Quantity
// ══════════════════════════════════════════════════════════════

/**
 * FHIR `Quantity` — a measured or measurable amount with optional units.
 * Used for vitals (heart rate, blood pressure, temperature, etc.).
 */
export interface Quantity {
  /** The numerical value. */
  value?: FhirDecimal;
  /** How the value should be interpreted (<, <=, >, >=). */
  comparator?: '<' | '<=' | '>=' | '>';
  /** Unit representation (e.g. 'bpm', 'mmHg', 'kg'). */
  unit?: FhirString;
  /** System defining the unit (UCUM, etc.). */
  system?: FhirUri;
  /** Coded form of the unit. */
  code?: FhirCode;
}

/**
 * FHIR `Ratio` — a ratio of two quantities (e.g. 120/80 for blood pressure).
 */
export interface Ratio {
  /** Numerator of the ratio. */
  numerator?: Quantity;
  /** Denominator of the ratio. */
  denominator?: Quantity;
}

// ══════════════════════════════════════════════════════════════
// DATATYPE: Attachment
// ══════════════════════════════════════════════════════════════

/**
 * FHIR `Attachment` — a file or link to a file (e.g. a radiology image).
 */
export interface Attachment {
  /** MIME type of the attachment. */
  contentType?: FhirCode;
  /** Human-readable description. */
  title?: FhirString;
  /** Base64-encoded data (inline content). */
  data?: FhirString;
  /** URL where the data can be retrieved. */
  url?: FhirUri;
  /** Size in bytes. */
  size?: FhirInteger;
  /** Hash of the data (for integrity verification). */
  hash?: FhirString;
  /** When the attachment was created. */
  creation?: FhirDateTime;
}

// ══════════════════════════════════════════════════════════════
// DATATYPE: Reference
// ══════════════════════════════════════════════════════════════

/**
 * FHIR `Reference` — a pointer to another resource (by type + ID).
 * Example: { reference: 'Patient/123', display: 'John Doe' }
 */
export interface Reference {
  /** Relative or absolute URL of the referenced resource. */
  reference?: FhirString;
  /** Type the reference points to (e.g. 'Patient', 'Practitioner'). */
  type?: FhirUri;
  /** Logical identifier of the resource (alternative to reference). */
  identifier?: Identifier;
  /** Human-readable description of the target. */
  display?: FhirString;
}

// ══════════════════════════════════════════════════════════════
// BASE RESOURCE TYPES
// ══════════════════════════════════════════════════════════════

/**
 * FHIR `Resource` — the absolute base type for ALL FHIR resources.
 * Every resource has a `resourceType` discriminator and optional metadata.
 */
export interface Resource {
  /** Discriminator field identifying the resource type (e.g. 'Patient'). */
  resourceType: string;
  /** Logical ID of the resource (used in URLs, references). */
  id?: FhirId;
  /** Metadata about the resource (version, tags, profiles). */
  meta?: Meta;
  /** Business identifiers (MRN, SSN, etc.). */
  implicitRules?: FhirUri;
  /** Language of the resource content (BCP-47 code). */
  language?: FhirCode;
}

/**
 * FHIR `DomainResource` — extends Resource with common fields shared by
 * all clinical resources: text (narrative), contained resources, extensions.
 */
export interface DomainResource extends Resource {
  /** Human-readable narrative summary (XHTML). */
  text?: {
    status: 'generated' | 'extensions' | 'additional' | 'empty';
    div: FhirString;
  };
  /** Contained inline resources (embedded, not standalone). */
  contained?: Resource[];
  /** Extensions not defined in the base resource. */
  extension?: Extension[];
  /** Extensions that modify the meaning of the base element. */
  modifierExtension?: Extension[];
}

// ══════════════════════════════════════════════════════════════
// BUNDLE (collection of resources)
// ══════════════════════════════════════════════════════════════

/**
 * FHIR `BundleEntry` — a single entry in a Bundle (a resource + metadata).
 */
export interface BundleEntry {
  /** Links related to this entry. */
  fullUrl?: FhirUri;
  /** The resource contained in this entry. */
  resource?: Resource;
  /** Search-related metadata (for search results). */
  search?: {
    mode?: 'match' | 'include' | 'outcome';
    score?: FhirDecimal;
  };
  /** Request metadata (for transaction/batch bundles). */
  request?: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    url: FhirUri;
    ifMatch?: FhirString;
    ifNoneMatch?: FhirString;
    ifModifiedSince?: FhirInstant;
    ifNoneExist?: FhirString;
  };
  /** Response metadata (for transaction/batch response bundles). */
  response?: {
    status: FhirString;
    location?: FhirUri;
    etag?: FhirString;
    lastModified?: FhirInstant;
    outcome?: Resource;
  };
}

/**
 * FHIR `Bundle` — a collection of resources with a type discriminator.
 * Used for batch operations, search results, and document packaging.
 */
export interface Bundle extends Resource {
  resourceType: 'Bundle';
  /** Type of bundle (collection, transaction, batch, searchset, etc.). */
  type: 'document' | 'message' | 'transaction' | 'transaction-response' | 'batch' | 'batch-response' | 'history' | 'searchset' | 'collection';
  /** Total number of resources (for searchset bundles). */
  total?: FhirInteger;
  /** Entries in the bundle. */
  entry?: BundleEntry[];
  /** Timestamp of the bundle. */
  timestamp?: FhirInstant;
}
