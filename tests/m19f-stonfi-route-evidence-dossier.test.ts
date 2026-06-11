import { describe, expect, it } from 'vitest';
import {
  createFixtureFinalDossierM19F,
  createStonfiRouteEvidenceDossierTemplateM19F,
  validateStonfiRouteEvidenceDossierM19F,
} from '../scripts/stonfi_route_evidence_dossier_m19f';
import { deterministicAddress } from '../scripts/stonfi_v2_1_route_lib';

describe('M19F STON.fi route evidence dossier validation', () => {
  it('template is intentionally non-final and cannot unlock BuybackBurn', () => {
    const template = createStonfiRouteEvidenceDossierTemplateM19F();
    const report = validateStonfiRouteEvidenceDossierM19F(template);

    expect(report.route_freeze_ready).toBe(false);
    expect(report.issue_codes).toContain('DOSSIER_STATUS_NOT_FINAL_ROUTE_FREEZE_CANDIDATE');
    expect(report.issue_codes.some((code) => code.startsWith('CHECKLIST_'))).toBe(true);
  });

  it('accepts a complete evidence dossier and delegates payload validation to the M19E collector', () => {
    const dossier = createFixtureFinalDossierM19F();
    const report = validateStonfiRouteEvidenceDossierM19F(dossier);

    expect(report.issue_codes).toEqual([]);
    expect(report.collector_route_freeze_ready).toBe(true);
    expect(report.route_freeze_ready).toBe(true);
    expect(report.rebuilt_hashes?.ptonTransferBodyHash).toBe(report.rebuilt_hashes?.samplePtonTransferBodyHash);
  });

  it('rejects a dossier with all payload data present but missing immutable evidence references', () => {
    const dossier = createFixtureFinalDossierM19F();
    dossier.evidenceRefs.liveQuote = 'required: quote source and timestamp/block';

    const report = validateStonfiRouteEvidenceDossierM19F(dossier);

    expect(report.route_freeze_ready).toBe(false);
    expect(report.issue_codes).toContain('MISSING_EVIDENCE_REF_LIVEQUOTE');
  });

  it('RT-BUY-001/RT-BUY-002: rejects a final dossier without query_id propagation and body-shape evidence', () => {
    const dossier = createFixtureFinalDossierM19F();
    dossier.requiredEvidenceChecklist.athNotificationQueryIdPropagatesToBuybackBurn = false;
    dossier.requiredEvidenceChecklist.refundExcessBodyShapesMatchBuybackBurnHandlers = false;
    dossier.evidenceRefs.athNotificationQueryIdPropagationProof = 'required: query_id propagation proof';
    dossier.evidenceRefs.refundExcessBodyShapeProof = 'required: refund/excess body shape proof';

    const report = validateStonfiRouteEvidenceDossierM19F(dossier);

    expect(report.route_freeze_ready).toBe(false);
    expect(report.issue_codes).toContain('CHECKLIST_ATHNOTIFICATIONQUERYIDPROPAGATESTOBUYBACKBURN_NOT_TRUE');
    expect(report.issue_codes).toContain('CHECKLIST_REFUNDEXCESSBODYSHAPESMATCHBUYBACKBURNHANDLERS_NOT_TRUE');
    expect(report.issue_codes).toContain('MISSING_EVIDENCE_REF_ATHNOTIFICATIONQUERYIDPROPAGATIONPROOF');
    expect(report.issue_codes).toContain('MISSING_EVIDENCE_REF_REFUNDEXCESSBODYSHAPEPROOF');
  });

  it('rejects placeholder addresses before the lower-level collector tries to decode route evidence', () => {
    const dossier = createFixtureFinalDossierM19F();
    dossier.liveEvidenceInput.addresses.stonfiPoolAddressTonAth = 'EQ... selected STON.fi TON/ATH pool address';

    const report = validateStonfiRouteEvidenceDossierM19F(dossier);

    expect(report.route_freeze_ready).toBe(false);
    expect(report.issue_codes).toContain('BAD_ADDRESS_STONFIPOOLADDRESSTONATH');
  });

  it('rejects SDK tx params whose destination is changed away from the pinned pTON wallet', () => {
    const dossier = createFixtureFinalDossierM19F();
    dossier.liveEvidenceInput.sdkTxParams.to = deterministicAddress('M19F.bad.tx.to').toString();

    const report = validateStonfiRouteEvidenceDossierM19F(dossier);

    expect(report.route_freeze_ready).toBe(false);
    expect(report.issue_codes).toContain('COLLECTOR_SDK_TX_TO_NOT_PTON_WALLET');
  });
});
