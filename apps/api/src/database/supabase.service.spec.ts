import { ModelRepository } from './supabase.service';

describe('ModelRepository column mapping', () => {
  it('writes invoice_items.quantity instead of the inventory current_stock column', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{ id: 'item-1' }] });
    const repo = new ModelRepository('invoice_items', query);

    await repo.create({
      data: {
        invoiceId: 'inv-1',
        description: 'Consultation',
        quantity: 2,
        unitPriceKES: 100,
        lineTotal: 200,
      },
    });

    const sql = query.mock.calls[0][0] as string;
    const params = query.mock.calls[0][1] as any[];
    expect(sql).toContain('"quantity"');
    expect(sql).not.toContain('current_stock');
    expect(params).toContain(2);
  });

  it('still maps inventory quantity to current_stock', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{ id: 'stock-1' }] });
    const repo = new ModelRepository('inventory', query);

    await repo.create({ data: { name: 'Bed sheets', quantity: 12 } });

    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain('"current_stock"');
  });
});
