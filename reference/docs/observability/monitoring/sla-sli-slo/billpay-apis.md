---
title: Billpay Core APIs
sidebar_label: Billpay Core APIs
sidebar_position: 2
---

# SLA · SLI · SLO — Billpay Core APIs

These sit one layer below the One-Data functions. Latency targets are slightly
tighter because the API removes the function-edge overhead.

For definitions of SLA / SLI / SLO and how to read each card, see the
[overview page](./).

## Create Payment

<div className="bp-sla">
  <div className="bp-sla__header">
    <div>
      <h3 className="bp-sla__title">Create Payment</h3>
      <small className="bp-sla__endpoint">Billpay Core API · <code>POST /payments</code></small>
    </div>
    <span className="bp-sla__avail">SLA availability: <strong>99.95%</strong></span>
  </div>
  <div className="bp-sla__grid">
    <div className="bp-sla__cell"><span className="bp-sla__pct">P50</span><span className="bp-sla__val">120<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P90</span><span className="bp-sla__val">250<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P99</span><span className="bp-sla__val">500<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P99.9</span><span className="bp-sla__val">900<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P99.99</span><span className="bp-sla__val">1.5<span className="bp-sla__unit">s</span></span></div>
  </div>
  <p className="bp-sla__sli"><strong>SLI:</strong> request-to-response latency at the Billpay Core ingress, excluding client network. <strong>Error budget:</strong> 0.05% / 30-day window.</p>
</div>

## Update Payment

<div className="bp-sla">
  <div className="bp-sla__header">
    <div>
      <h3 className="bp-sla__title">Update Payment</h3>
      <small className="bp-sla__endpoint">Billpay Core API · <code>PUT /payments/&#123;id&#125;</code></small>
    </div>
    <span className="bp-sla__avail">SLA availability: <strong>99.95%</strong></span>
  </div>
  <div className="bp-sla__grid">
    <div className="bp-sla__cell"><span className="bp-sla__pct">P50</span><span className="bp-sla__val">160<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P90</span><span className="bp-sla__val">320<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P99</span><span className="bp-sla__val">650<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P99.9</span><span className="bp-sla__val">1.1<span className="bp-sla__unit">s</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P99.99</span><span className="bp-sla__val">1.8<span className="bp-sla__unit">s</span></span></div>
  </div>
  <p className="bp-sla__sli"><strong>SLI:</strong> total time for <code>#UpdatePaymentWF</code> round-trip (cancel + recreate + mapping). <strong>Error budget:</strong> 0.05% / 30-day window.</p>
</div>

## Cancel Payment

<div className="bp-sla">
  <div className="bp-sla__header">
    <div>
      <h3 className="bp-sla__title">Cancel Payment</h3>
      <small className="bp-sla__endpoint">Billpay Core API · <code>DELETE /payments/&#123;id&#125;</code></small>
    </div>
    <span className="bp-sla__avail">SLA availability: <strong>99.95%</strong></span>
  </div>
  <div className="bp-sla__grid">
    <div className="bp-sla__cell"><span className="bp-sla__pct">P50</span><span className="bp-sla__val">100<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P90</span><span className="bp-sla__val">200<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P99</span><span className="bp-sla__val">420<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P99.9</span><span className="bp-sla__val">800<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P99.99</span><span className="bp-sla__val">1.3<span className="bp-sla__unit">s</span></span></div>
  </div>
  <p className="bp-sla__sli"><strong>SLI:</strong> <code>#CancelPaymentWF</code> round-trip including external eligibility checks. <strong>Error budget:</strong> 0.05% / 30-day window.</p>
</div>

## Record Return

<div className="bp-sla">
  <div className="bp-sla__header">
    <div>
      <h3 className="bp-sla__title">Record Return</h3>
      <small className="bp-sla__endpoint">Billpay Core API · <code>POST /payments/returns</code></small>
    </div>
    <span className="bp-sla__avail">SLA availability: <strong>99.9%</strong> (async)</span>
  </div>
  <div className="bp-sla__grid">
    <div className="bp-sla__cell"><span className="bp-sla__pct">P50</span><span className="bp-sla__val">80<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P90</span><span className="bp-sla__val">180<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P99</span><span className="bp-sla__val">380<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P99.9</span><span className="bp-sla__val">700<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P99.99</span><span className="bp-sla__val">1.2<span className="bp-sla__unit">s</span></span></div>
  </div>
  <p className="bp-sla__sli"><strong>SLI:</strong> handler ack latency — measured from event receipt to workflow enqueue. <code>#ProcessReturnedPaymentWF</code> runs asynchronously after this. <strong>Error budget:</strong> 0.1% / 30-day window.</p>
</div>

## Inbound Payment

<div className="bp-sla">
  <div className="bp-sla__header">
    <div>
      <h3 className="bp-sla__title">Inbound Payment</h3>
      <small className="bp-sla__endpoint">Billpay Core API · <code>POST /payments/inbound</code></small>
    </div>
    <span className="bp-sla__avail">SLA availability: <strong>99.9%</strong> (async)</span>
  </div>
  <div className="bp-sla__grid">
    <div className="bp-sla__cell"><span className="bp-sla__pct">P50</span><span className="bp-sla__val">90<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P90</span><span className="bp-sla__val">200<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P99</span><span className="bp-sla__val">400<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P99.9</span><span className="bp-sla__val">750<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P99.99</span><span className="bp-sla__val">1.3<span className="bp-sla__unit">s</span></span></div>
  </div>
  <p className="bp-sla__sli"><strong>SLI:</strong> ack latency to upstream Batch Gateway. Full posting completes asynchronously via <code>#ProcessInboundPaymentWF</code>. <strong>Error budget:</strong> 0.1% / 30-day window.</p>
</div>

## Credit Balance Refund

<div className="bp-sla">
  <div className="bp-sla__header">
    <div>
      <h3 className="bp-sla__title">Credit Balance Refund</h3>
      <small className="bp-sla__endpoint">Billpay Core API · <code>POST /refunds</code></small>
    </div>
    <span className="bp-sla__avail">SLA availability: <strong>99.95%</strong></span>
  </div>
  <div className="bp-sla__grid">
    <div className="bp-sla__cell"><span className="bp-sla__pct">P50</span><span className="bp-sla__val">140<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P90</span><span className="bp-sla__val">280<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P99</span><span className="bp-sla__val">550<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P99.9</span><span className="bp-sla__val">950<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P99.99</span><span className="bp-sla__val">1.6<span className="bp-sla__unit">s</span></span></div>
  </div>
  <p className="bp-sla__sli"><strong>SLI:</strong> request-to-response latency for <code>#CreateBalanceRefundWF</code> entry through <code>ACCEPTED</code>. <strong>Error budget:</strong> 0.05% / 30-day window.</p>
</div>

## List Payments by Account

<div className="bp-sla">
  <div className="bp-sla__header">
    <div>
      <h3 className="bp-sla__title">List Payments by Account</h3>
      <small className="bp-sla__endpoint">Billpay Core API · <code>GET /payments/account/&#123;id&#125;</code></small>
    </div>
    <span className="bp-sla__avail">SLA availability: <strong>99.99%</strong></span>
  </div>
  <div className="bp-sla__grid">
    <div className="bp-sla__cell"><span className="bp-sla__pct">P50</span><span className="bp-sla__val">45<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P90</span><span className="bp-sla__val">95<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P99</span><span className="bp-sla__val">200<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P99.9</span><span className="bp-sla__val">400<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P99.99</span><span className="bp-sla__val">700<span className="bp-sla__unit">ms</span></span></div>
  </div>
  <p className="bp-sla__sli"><strong>SLI:</strong> read latency from primary store; cached reads should be substantially faster. <strong>Error budget:</strong> 0.01% / 30-day window.</p>
</div>

## Read Payment

<div className="bp-sla">
  <div className="bp-sla__header">
    <div>
      <h3 className="bp-sla__title">Read Payment</h3>
      <small className="bp-sla__endpoint">Billpay Core API · <code>GET /payments/&#123;id&#125;</code></small>
    </div>
    <span className="bp-sla__avail">SLA availability: <strong>99.99%</strong></span>
  </div>
  <div className="bp-sla__grid">
    <div className="bp-sla__cell"><span className="bp-sla__pct">P50</span><span className="bp-sla__val">35<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P90</span><span className="bp-sla__val">80<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P99</span><span className="bp-sla__val">170<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P99.9</span><span className="bp-sla__val">350<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P99.99</span><span className="bp-sla__val">600<span className="bp-sla__unit">ms</span></span></div>
  </div>
  <p className="bp-sla__sli"><strong>SLI:</strong> read latency for a single payment + its lifecycle events. <strong>Error budget:</strong> 0.01% / 30-day window.</p>
</div>

## Payment Installments

<div className="bp-sla">
  <div className="bp-sla__header">
    <div>
      <h3 className="bp-sla__title">Payment Installments</h3>
      <small className="bp-sla__endpoint">Billpay Core API (composite) · <code>POST /paymentInstallments</code></small>
    </div>
    <span className="bp-sla__avail">SLA availability: <strong>99.9%</strong></span>
  </div>
  <div className="bp-sla__grid">
    <div className="bp-sla__cell"><span className="bp-sla__pct">P50</span><span className="bp-sla__val">220<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P90</span><span className="bp-sla__val">450<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P99</span><span className="bp-sla__val">900<span className="bp-sla__unit">ms</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P99.9</span><span className="bp-sla__val">1.6<span className="bp-sla__unit">s</span></span></div>
    <div className="bp-sla__cell"><span className="bp-sla__pct">P99.99</span><span className="bp-sla__val">2.4<span className="bp-sla__unit">s</span></span></div>
  </div>
  <p className="bp-sla__sli"><strong>SLI:</strong> end-to-end latency for the composite — child Create-Immediate + Installments + optional Autopay. <strong>Error budget:</strong> 0.1% / 30-day window.</p>
</div>
