# Onboarding Form Schema
> Complete field-level schema extracted from all documents in `/docs`.
> Data types: `text`, `date`, `number`, `boolean`, `enum`, `table`, `signature`, `file`.

---

## 1. Application Form Permanent — Full Schema

### 1.1 Header
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| positionAppliedFor | text | Yes | Position/designation applying for |
| photograph | file | Yes | Recent passport-size photograph |

### 1.2 Personal Identity
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| salutation | enum | Yes | Mr / Mrs / Ms |
| firstName | text | Yes | |
| middleName | text | No | |
| lastName | text | Yes | Family/surname |
| fatherSalutation | enum | Yes | Mr (fixed) |
| fatherFirstName | text | Yes | |
| fatherMiddleName | text | No | |
| fatherLastName | text | Yes | |

### 1.3 Present Postal Address
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| presentAddress | text | Yes | Multi-line street address |
| presentPinCode | text | Yes | 6-digit PIN |
| presentResidenceTel | text | No | |
| presentMobileTel | text | Yes | |
| presentEmail | text | Yes | |

### 1.4 Permanent Postal Address
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| permanentAddress | text | Yes | Multi-line street address |
| permanentPinCode | text | Yes | 6-digit PIN |
| permanentResidenceTel | text | No | |
| permanentMobileTel | text | Yes | |
| permanentEmail | text | No | |

### 1.5 Bank Details
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| bankName | text | Yes | |
| employeeNameAsPerBankAccount | text | Yes | Must match account name exactly |
| bankBranchName | text | Yes | |
| bankBranchAddress | text | Yes | |
| bankAccountNumber | text | Yes | |
| ifscCode | text | Yes | |
| micrCode | text | No | Printed on cheque leaf |
| bankProofAttachment | file | Yes | Passbook front page or cancelled cheque |

### 1.6 Personal Details
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| dateOfBirth | date | Yes | DD/MM/YYYY |
| dateOfJoining | date | Yes | DD/MM/YYYY |
| employmentType | enum | Yes | Permanent / Contractual |
| heightCm | number | Yes | In centimetres |
| weightKg | number | Yes | In kilograms |
| bloodGroup | text | Yes | e.g. A+, B-, O+ |
| age | number | Yes | |
| religion | text | Yes | |
| gender | enum | Yes | Male / Female |
| maritalStatus | enum | Yes | Single / Married / Divorced / Separated / Widowed |
| spouseName | text | Conditional | Required if married |
| spouseDateOfBirth | date | Conditional | Required if married |
| hasChildren | boolean | Yes | Yes / No |
| numberOfSons | number | Conditional | Required if hasChildren = Yes |
| numberOfDaughters | number | Conditional | Required if hasChildren = Yes |
| branch | text | Yes | Branch/office location |
| department | text | Yes | |
| designation | text | Yes | |

### 1.7 Identity Documents
Repeating table — one row per document type:
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| documentType | enum | — | Aadhaar Card / Passport / Driving Licence / Election Card / Ration Card / ESIC Card / Others |
| nameAsOnDocument | text | Conditional | |
| documentNumber | text | Conditional | |

At least Aadhaar Card is required. Passport required if international worker.

### 1.8 Medical & Legal Declarations
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| everConvictedCriminal | boolean | Yes | |
| criminalConvictionDetails | text | Conditional | Required if Yes |
| everTreatedDrugAlcohol | boolean | Yes | |
| drugAlcoholDetails | text | Conditional | Required if Yes |
| preExistingMedicalCondition | boolean | Yes | |
| physicalDefectOrDisability | boolean | Yes | |
| disabilityDetails | text | Conditional | Required if Yes |

### 1.9 References (Two required, not relatives)
Repeating group × 2:
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| referenceFirstName | text | Yes | |
| referenceMiddleName | text | No | |
| referenceLastName | text | Yes | |
| referenceCompanyName | text | Yes | |
| referenceAddress | text | Yes | |
| referenceRelationship | text | Yes | |
| referenceResidenceTel | text | No | |
| referenceMobileTel | text | Yes | |

### 1.10 Emergency Contact
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| emergencyContactFirstName | text | Yes | |
| emergencyContactMiddleName | text | No | |
| emergencyContactLastName | text | Yes | |
| emergencyContactAddress | text | Yes | |
| emergencyContactRelationship | text | Yes | |
| emergencyContactResidenceTel | text | No | |
| emergencyContactMobileTel | text | Yes | |

### 1.11 Education & Qualifications
Repeating table (4+ rows):
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| instituteOrBoard | text | Yes | |
| examinationPassed | text | Yes | e.g. SSC, HSC, B.Sc., B.E. |
| specification | text | No | Subject/stream |
| yearPassed | number | Yes | |
| percentageOrGrade | text | Yes | |

### 1.12 Professional Qualifications
Same structure as 1.11 — for certifications, diplomas, professional courses.

### 1.13 Language Competency
Repeating table:
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| language | text | Yes | e.g. English, Hindi, Bengali |
| readLevel | enum | Yes | B (Basic) / I (Intermediate) / F (Fluent) |
| writeLevel | enum | Yes | B / I / F |
| speakLevel | enum | Yes | B / I / F |

### 1.14 Employment History
Repeating table (up to ~9 rows):
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| employerNameAndCity | text | Yes | Most recent first |
| fromMonth | number | Yes | MM |
| fromYear | number | Yes | YY |
| toMonth | number | Yes | MM |
| toYear | number | Yes | YY |
| positionHeld | text | Yes | |
| department | text | No | |
| lastCTC | number | Yes | In INR |
| reasonForLeaving | text | Yes | For most recent position |

### 1.15 Open Text / Essay Fields
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| orgChartDrawing | text/image | No | Free-draw section |
| sportsAndHobbies | text | No | |
| recentOperations | text | No | |
| careerAchievements | text | No | |
| careerObjective | text | Yes | |
| strengthsAndImprovements | text | Yes | 3 points each |
| suitabilityForPosition | text | Yes | |
| relativeInCompany | boolean | Yes | |
| relativeDetails | text | Conditional | If yes |

### 1.16 Declaration
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| declarationDate | date | Yes | |
| declarationSignature | signature | Yes | |

### 1.17 Enclosures Checklist
| Field | Type | Notes |
|-------|------|-------|
| bioData | boolean | |
| allCredentialCertificates | boolean | |
| relievingLetter | boolean | |
| ageProof | boolean | |
| twoPassportPhotographs | boolean | |
| form11 | boolean | EPF form |
| addressProof | boolean | |
| payslipsLast3Months | boolean | |
| aadhaarCard | boolean | |
| bankProof | boolean | |
| esicDeclaration | boolean | |
| disabilityCertificate | boolean | If applicable |

---

## 2. Form 11 (EPF) — Schema

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| memberName | text | Yes | |
| fathersName | text | Conditional | One of father's or spouse's name |
| spouseName | text | Conditional | One of father's or spouse's name |
| dateOfBirth | date | Yes | DD/MM/YYYY |
| gender | enum | Yes | Male / Female / Transgender |
| maritalStatus | enum | Yes | Married / Unmarried / Widow / Widower / Divorcee |
| emailId | text | Yes | |
| mobileNo | text | Yes | |
| dateOfJoiningCurrentEstablishment | date | Yes | DD/MM/YYYY |
| bankAccountNo | text | Yes | KYC |
| bankIFSCode | text | Yes | KYC |
| aadhaarNumber | text | Yes | KYC |
| pan | text | No | KYC — if available |
| wasEPFMemberBefore | boolean | Yes | |
| wasEPSMemberBefore | boolean | Yes | |
| **Previous Employment (Un-exempted) — repeating** | | | Only if wasEPFMember = Yes |
| prevEstablishmentNameAddress | text | Conditional | |
| prevUAN | text | Conditional | Universal Account Number |
| prevPFAccountNumber | text | Conditional | |
| prevDateOfJoining | date | Conditional | DD/MM/YYYY |
| prevDateOfExit | date | Conditional | DD/MM/YYYY |
| prevSchemeCertificateNo | text | No | |
| prevPPONumber | text | No | |
| prevNCPDays | number | No | Non-Contributory Period days |
| **Previous Employment (Exempted Trust) — repeating** | | | |
| trustNameAddress | text | Conditional | |
| trustUAN | text | Conditional | |
| trustMemberEPSAccountNo | text | Conditional | |
| trustDateOfJoining | date | Conditional | |
| trustDateOfExit | date | Conditional | |
| trustSchemeCertificateNo | text | No | |
| trustNCPDays | number | No | |
| isInternationalWorker | boolean | Yes | |
| countryOfOrigin | text | Conditional | If international worker |
| passportNo | text | Conditional | If international worker |
| passportValidFrom | date | Conditional | |
| passportValidTo | date | Conditional | |
| memberSignature | signature | Yes | |
| memberSignatureDate | date | Yes | |
| memberSignaturePlace | text | Yes | |

---

## 3. Form A (PF Membership) — Schema

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| date | date | Yes | Day and month |
| nameInFull | text | Yes | |
| address | text | Yes | |
| dateOfBirth | date | Yes | |
| designation | text | Yes | |
| natureOfAppointment | text | Yes | e.g. Permanent / Contractual / Trainee |
| dateOfJoiningService | date | Yes | |
| salaryPerMensem | number | Yes | Monthly salary in INR |
| verifiedBy | text | Yes | HR/management counter-sign |
| employeeSignature | signature | Yes | |

---

## 4. Form B (PF Nomination) — Schema

### Employee Details
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| employeeNameFirstName | text | Yes | In block capitals |
| employeeNameSurname | text | Yes | |
| sex | enum | Yes | Male / Female |
| religion | text | Yes | |
| fathersName | text | Yes | |
| husbandName | text | Conditional | If married |
| maritalStatus | text | Yes | |
| dateOfBirth | date | Yes | Day / Month / Year |
| permanentAddressVillage | text | Yes | |
| permanentAddressThana | text | Yes | |
| permanentAddressPO | text | Yes | Post Office |
| permanentAddressDistrict | text | Yes | |
| permanentAddressState | text | Yes | |

### Nomination (Repeating rows)
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| nomineeNameAndAddress | text | Yes | Full name + address |
| nomineeRelationship | text | Yes | |
| nomineeAge | number | Yes | |
| proportionOfShare | text | Yes | e.g. "100%" or "50%" |

### Certification
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| declarationDate | date | Yes | |
| employeeSignature | signature | Yes | |
| witness1Name | text | Yes | |
| witness1Signature | signature | Yes | |
| witness2Name | text | Yes | |
| witness2Signature | signature | Yes | |
| inChargeSignature | signature | Yes | Counter-sign |

---

## 5. Form 1 (ESIC) — Schema

### Section A — Insured Person
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| insuranceNo | text | No | Allotted by ESIC; blank at submission |
| nameBlockLetters | text | Yes | |
| fatherOrHusbandName | text | Yes | |
| dateOfBirth | date | Yes | Day/Month/Year |
| maritalStatus | enum | Yes | Married (M) / Unmarried (U) / Widowed (W) |
| sex | enum | Yes | M / F |
| presentAddress | text | Yes | |
| presentPinCode | text | Yes | |
| presentTelOrEmail | text | No | |
| permanentAddress | text | Yes | |
| permanentPinCode | text | Yes | |
| permanentTelOrEmail | text | No | |
| branchOffice | text | Yes | ESIC branch |
| dispensary | text | Yes | Assigned dispensary name |

### Section B — Employer
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| employerCodeNo | text | Yes | |
| dateOfAppointment | date | Yes | Day/Month/Year |
| employerNameAndAddress | text | Yes | |

### Previous Employment (if any)
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| previousInsuranceNo | text | Conditional | |
| previousEmployerCodeNo | text | Conditional | |
| previousEmployerNameAndAddress | text | Conditional | |

### Section C — Death Benefit Nominee
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| nomineeName | text | Yes | |
| nomineeRelationship | text | Yes | |
| nomineeAddress | text | Yes | |

### Section D — Family Particulars (Repeating)
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| familyMemberName | text | Yes | |
| familyMemberDOBOrAge | date/number | Yes | |
| familyMemberRelationship | text | Yes | |
| residingWithEmployee | boolean | Yes | |
| placeOfResidenceTown | text | Conditional | If not residing with employee |
| placeOfResidenceState | text | Conditional | If not residing with employee |

### Signatures
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| employerCounterSignature | signature | Yes | |
| insuredPersonSignatureOrThumbImpression | signature | Yes | |

---

## 6. Bank Details Form — Schema

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| employeeName | text | Yes | |
| bankName | text | Yes | |
| branchName | text | Yes | |
| branchAddress | text | Yes | |
| accountNumber | text | Yes | |
| ifscCode | text | Yes | |
| attachment | file | Yes | Passbook OR cancelled cheque |
| employeeSignature | signature | Yes | |

---

## 7. Gratuity Form F — Schema

### Employee Statement
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| employeeNameInFull | text | Yes | |
| religion | text | Yes | |
| maritalStatus | enum | Yes | Unmarried / Married / Widow / Widower |
| department | text | Yes | |
| branchOrSection | text | Yes | |
| postHeld | text | Yes | Job title / designation |
| ticketOrSerialNo | text | No | Employee number |
| dateOfAppointment | date | Yes | |
| permanentAddressVillage | text | Yes | |
| permanentAddressThana | text | Yes | |
| permanentAddressSubDivision | text | No | |
| permanentAddressPostOffice | text | Yes | |
| permanentAddressDistrict | text | Yes | |
| permanentAddressState | text | Yes | |

### Nomination (Repeating)
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| nomineeFullNameAndAddress | text | Yes | |
| nomineeRelationship | text | Yes | |
| nomineeAge | number | Yes | |
| proportionOfGratuity | text | Yes | e.g. 100% or % per nominee |

### Certification
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| declarationDate | date | Yes | |
| declarationPlace | text | Yes | |
| employeeSignatureOrThumbImpression | signature | Yes | |
| witness1NameAndAddress | text | Yes | |
| witness1Signature | signature | Yes | |
| witness2NameAndAddress | text | Yes | |
| witness2Signature | signature | Yes | |

### Employer Certificate
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| employerReferenceNo | text | No | |
| employerSignatureWithDesignation | signature | Yes | |
| establishmentNameAndAddress | text | Yes | |
| certificationDate | date | Yes | |
| establishmentSeal | — | Yes | Rubber stamp |

---

## 8. Form 12BB (Income Tax) + Consent Letter — Schema

### Consent Letter
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| employeeName | text | Yes | |
| pan | text | Yes | |
| phoneNo | text | Yes | |
| emailId | text | Yes | |
| employeeCode | text | Yes | |
| designation | text | Yes | |
| branchOrDivision | text | Yes | |
| taxRegimeChoice | enum | Yes | Old Tax Regime / New Tax Regime |
| financialYear | text | Yes | e.g. 2023-2024 |
| employeeSignature | signature | Yes | |
| date | date | Yes | |

### Form 12BB — HRA Section
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| rentPaidToLandlord | number | Conditional | Annual amount |
| landlordName | text | Conditional | |
| landlordAddress | text | Conditional | |
| landlordPAN | text | Conditional | Mandatory if annual rent > ₹1,00,000 |

### Form 12BB — LTA Section
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| ltaAmount | number | Conditional | Leave Travel Concession amount |
| ltaEvidenceDocumentNo | text | Conditional | |

### Form 12BB — Home Loan Interest Section
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| interestPaidToLender | number | Conditional | Annual amount |
| lenderName | text | Conditional | |
| lenderAddress | text | Conditional | |
| lenderPAN | text | Yes (if claimed) | Mandatory |

### Form 12BB — Chapter VI-A Deductions
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| section80C_a | number | No | Investment type + amount (sub-item a) |
| section80C_b | number | No | Sub-item b |
| section80C_c | number | No | Sub-item c |
| section80C_d | number | No | Sub-item d |
| section80C_e | number | No | Sub-item e |
| section80C_f | number | No | Sub-item f |
| section80C_g | number | No | Sub-item g |
| section80CCC | number | No | Pension fund |
| section80CCD | number | No | NPS contribution |
| otherSectionsType_1 | text | No | e.g. 80E, 80G, 80TTA |
| otherSectionsAmount_1 | number | No | |
| otherSectionsType_2 | text | No | |
| otherSectionsAmount_2 | number | No | |

### Form 12BB — Verification
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| declarantFullName | text | Yes | Son/Daughter of … |
| evidenceFinancialInstitution | file | Conditional | |
| evidenceEmployer | file | Conditional | |
| evidenceOthers | file | No | |
| verificationDate | date | Yes | |
| verificationPlace | text | Yes | |

---

## 9. Appointment Letter — Schema (HR-issued, returned signed)

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| refNo | text | HR | Format: C/YYYY-YY/HR/NNN |
| date | date | HR | |
| employeeFullName | text | HR | |
| employeeAddress | text | HR | |
| designation | text | HR | |
| workLevel | text | HR | E1-C / E1-B / E1-A / E2-B / E (overseas) |
| effectiveDateOfJoining | date | HR | |
| probationPeriod | text | HR | e.g. "One Year" / "Six months" |
| ctcAmount | number | HR | Annual total CTC |
| ctcCurrency | enum | HR | INR / MAD / ZAR / RMB |
| locationOrBranch | text | HR | |
| superannuationAge | number | HR | 58 / 60 / 65 depending on country |
| noticePeriod | text | HR | Typically 1 month |
| signatoryName | text | HR | |
| signatoryDesignation | text | HR | Manager-HR / Vice President |
| employeeSignatureConfirmation | signature | Employee | Signed copy returned |

### CTC Annexure (India letters only)
| Component | Field Name | Type | Notes |
|-----------|-----------|------|-------|
| Basic | basicMonthly / basicAnnual | number | |
| HRA | hraMonthly / hraAnnual | number | |
| Entertainment Allowance | entertainmentMonthly / entertainmentAnnual | number | |
| Conveyance | conveyanceMonthly / conveyanceAnnual | number | Lower grades |
| Furnishing Allowance | furnishingMonthly / furnishingAnnual | number | Senior grades |
| Gross | grossMonthly / grossAnnual | number | Sum of above |
| PF Employer Contribution | pfEmployerAnnual | number | Usually ₹1,800/month |
| ESIC Employer Contribution | esicEmployerAnnual | number | Lower salary brackets |
| LTA | ltaAnnual | number | |
| Bonus | bonusAnnual | number | Usually ₹15,000 |
| Medi Claim | mediClaimAnnual | number | Usually ₹2,000–₹2,500 |
| Gratuity | gratuityAnnual | number | (Basic/26 × 15) |
| Leave Encashment | leaveEncashmentAnnual | number | Max 15 days (30 post-confirmation) |
| **Total CTC** | **ctcAnnual** | number | Sum of all above |

---

## 10. Confirmation Letter — Schema (HR-issued)

| Field | Type | Notes |
|-------|------|-------|
| refNo | text | Format: C/YYYY-YY/HR/NNN |
| date | date | |
| employeeFullName | text | |
| designation | text | |
| employeeCode | text | MSK0XXXX |
| locationOrBranch | text | |
| workLevel | text | |
| confirmationEffectiveDate | date | |
| revisedCTCAnnexure | object | Same structure as Appointment Letter CTC Annexure |
| employeeSignatureConfirmation | signature | Signed copy returned |

---

## 11. Confirmation Appraisal Form — Schema

### Header
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| employeeName | text | Yes | |
| employeeId | text | Yes | MSK0XXXX |
| designation | text | Yes | |
| grade | text | Yes | E1-C / E1-B / E1-A / E2-B |
| locationOfPosting | text | Yes | Branch name |
| dateOfJoining | date | Yes | |
| nameOfAppraiser | text | Yes | |
| currentJobDescription | text | Yes | |

### Evaluation — Technical Track (Chemist roles)
| Field | Type | Max | Notes |
|-------|------|-----|-------|
| punctuality | number | 5 | |
| adherenceToOfficeDiscipline | number | 5 | |
| abilityToLearnAndUnderstand | number | 5 | |
| analyticalSkillsCriticalThinking | number | 5 | |
| honestyAndIntegrity | number | 5 | Score < 5 = not confirmed |
| workEfficiencyAndOutput | number | 5 | |
| communicationSkill | number | 5 | |
| accuracy | number | 5 | |
| abilityToWorkUnderPressure | number | 5 | |
| developmentalActivities | number | 5 | |
| totalMarksObtained | number | 50 | |
| chemistryTestScore | number | — | Separate |

### Evaluation — Operations Track
| Field | Type | Max | Notes |
|-------|------|-----|-------|
| punctuality | number | 5 | |
| disciplineOrBehavior | number | 5 | |
| motivation | number | 5 | |
| integrity | number | 5 | Score < 5 = not confirmed |
| communicationSkill | number | 5 | |
| knowledgeOfStandardsAndProcedures | number | 5 | |
| reportingAndDocumentation | number | 5 | |
| initiativeAndOriginality | number | 5 | |
| timeScheduleAndResponse | number | 5 | |
| mobility | number | 5 | |
| totalMarksObtained | number | 50 | |
| chemistryScore | number | — | Separate |

### Approval Chain (all tracks)
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| reportingAuthorityRemarks | text | Yes | |
| reportingAuthorityRecommendation | boolean | Yes | Yes/No |
| reportingAuthorityReasonIfNo | text | Conditional | Extension reason + period |
| reportingAuthoritySignature | signature | Yes | |
| reviewAuthority1Remarks | text | Yes | |
| reviewAuthority1Recommendation | boolean | Yes | |
| reviewAuthority1Signature | signature | Yes | |
| reviewAuthority2Remarks | text | Yes | |
| reviewAuthority2Recommendation | boolean | Yes | |
| reviewAuthority2Signature | signature | Yes | |
| reviewAuthority3Remarks | text | Yes | |
| reviewAuthority3Recommendation | boolean | Yes | |
| reviewAuthority3Signature | signature | Yes | |
| hrRemarks | text | Yes | |
| hikeRecommendedWEF | date | No | Effective date of salary hike |
| hrSignature | signature | Yes | |
| mdApproval | text | Yes | Managing Director sign-off |

---

## 12. Declaration of Confidentiality and Impartiality — Schema

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| employeeFullName | text | Yes | |
| companyName | text | Yes | Mitra S K Pvt. Ltd. / Primawave SSPL |
| date | date | Yes | |
| designation | text | Yes | |
| employeeSignature | signature | Yes | |

---

## Cross-Form Field Mapping

Fields that appear across multiple forms and should be stored once in the employee master:

| Master Field | Application Form | Form 11 | Form A | Form B | Form 1 | Gratuity |
|---|---|---|---|---|---|---|
| employeeName | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| dateOfBirth | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| gender | ✓ | ✓ | — | ✓ | ✓ | — |
| maritalStatus | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| fatherName | ✓ | ✓ | — | ✓ | ✓ | — |
| spouseName | ✓ | ✓ | — | ✓ | — | — |
| permanentAddress | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| designation | ✓ | — | ✓ | — | — | ✓ |
| dateOfJoining | ✓ | ✓ | ✓ | — | ✓ | ✓ |
| bankAccountNo | ✓ | ✓ | — | — | — | — |
| ifscCode | ✓ | ✓ | — | — | — | — |
| aadhaarNumber | ✓ | ✓ | — | — | — | — |
| pan | ✓ (in docs checklist) | ✓ | — | — | — | — |
| religion | ✓ | — | — | ✓ | — | ✓ |
| salary | — | — | ✓ | — | — | ✓ |
