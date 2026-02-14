const { Deal, User, PipelineStage, Pipeline, sequelize } = require('../models');
const { Op } = require('sequelize');

class ForecastService {
  /**
   * Get forecast summary KPIs
   */
  async getSummary(filters = {}) {
    const where = { status: 'open' };
    if (filters.pipeline_id) where.pipeline_id = filters.pipeline_id;
    if (filters.owner_id) where.owner_id = filters.owner_id;

    const [totalPipeline, weightedPipeline, bestCase, commit, dealCount, avgProbability] =
      await Promise.all([
        Deal.sum('value', { where }) || 0,
        sequelize.query(
          `SELECT COALESCE(SUM(value * probability / 100), 0) AS val FROM deals WHERE status = 'open' AND deleted_at IS NULL${filters.pipeline_id ? ` AND pipeline_id = ${parseInt(filters.pipeline_id)}` : ''}${filters.owner_id ? ` AND owner_id = ${parseInt(filters.owner_id)}` : ''}`,
          { type: sequelize.QueryTypes.SELECT }
        ),
        Deal.sum('value', { where: { ...where, probability: { [Op.gte]: 70 } } }) || 0,
        Deal.sum('value', { where: { ...where, probability: { [Op.gte]: 90 } } }) || 0,
        Deal.count({ where }),
        Deal.findOne({
          where,
          attributes: [[sequelize.fn('AVG', sequelize.col('probability')), 'avg']],
          raw: true,
        }),
      ]);

    return {
      total_pipeline: parseFloat(totalPipeline) || 0,
      weighted_pipeline: parseFloat(weightedPipeline[0]?.val) || 0,
      best_case: parseFloat(bestCase) || 0,
      commit: parseFloat(commit) || 0,
      deal_count: dealCount,
      avg_probability: parseFloat(avgProbability?.avg) || 0,
    };
  }

  /**
   * Get forecast grouped by month (expected close date)
   */
  async getByMonth(filters = {}) {
    const months = parseInt(filters.months) || 6;
    const now = new Date();
    const futureDate = new Date(now.getFullYear(), now.getMonth() + months, 0);

    const whereClause = [`status = 'open'`, `deleted_at IS NULL`, `expected_close_date IS NOT NULL`];
    whereClause.push(`expected_close_date >= '${now.toISOString().split('T')[0]}'`);
    whereClause.push(`expected_close_date <= '${futureDate.toISOString().split('T')[0]}'`);
    if (filters.pipeline_id) whereClause.push(`pipeline_id = ${parseInt(filters.pipeline_id)}`);
    if (filters.owner_id) whereClause.push(`owner_id = ${parseInt(filters.owner_id)}`);

    const results = await sequelize.query(
      `SELECT DATE_FORMAT(expected_close_date, '%Y-%m') AS month,
        SUM(value) AS total_value,
        SUM(value * probability / 100) AS weighted_value,
        COUNT(*) AS deal_count
       FROM deals WHERE ${whereClause.join(' AND ')}
       GROUP BY DATE_FORMAT(expected_close_date, '%Y-%m')
       ORDER BY month ASC`,
      { type: sequelize.QueryTypes.SELECT }
    );

    // Fill missing months with zeros
    const data = [];
    for (let i = 0; i < months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const existing = results.find((r) => r.month === monthKey);
      data.push({
        month: monthKey,
        label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        total_value: existing ? parseFloat(existing.total_value) : 0,
        weighted_value: existing ? parseFloat(existing.weighted_value) : 0,
        deal_count: existing ? parseInt(existing.deal_count) : 0,
      });
    }

    return data;
  }

  /**
   * Get forecast grouped by sales rep
   */
  async getByRep(filters = {}) {
    const where = { status: 'open' };
    if (filters.pipeline_id) where.pipeline_id = filters.pipeline_id;

    const results = await Deal.findAll({
      where,
      attributes: [
        'owner_id',
        [sequelize.fn('SUM', sequelize.col('Deal.value')), 'total_value'],
        [sequelize.literal('SUM(Deal.value * Deal.probability / 100)'), 'weighted_value'],
        [sequelize.fn('COUNT', sequelize.col('Deal.id')), 'deal_count'],
        [sequelize.fn('AVG', sequelize.col('Deal.probability')), 'avg_probability'],
      ],
      include: [
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'first_name', 'last_name'],
        },
      ],
      group: ['owner_id', 'owner.id', 'owner.first_name', 'owner.last_name'],
      raw: true,
      nest: true,
    });

    return results.map((r) => ({
      owner_id: r.owner_id,
      name: r.owner ? `${r.owner.first_name} ${r.owner.last_name}` : 'Unassigned',
      total_value: parseFloat(r.total_value) || 0,
      weighted_value: parseFloat(r.weighted_value) || 0,
      deal_count: parseInt(r.deal_count) || 0,
      avg_probability: parseFloat(r.avg_probability) || 0,
    }));
  }

  /**
   * Get forecast grouped by pipeline stage
   */
  async getByStage(filters = {}) {
    const where = { status: 'open' };
    if (filters.pipeline_id) where.pipeline_id = filters.pipeline_id;

    const results = await Deal.findAll({
      where,
      attributes: [
        'stage_id',
        [sequelize.fn('SUM', sequelize.col('Deal.value')), 'total_value'],
        [sequelize.literal('SUM(Deal.value * Deal.probability / 100)'), 'weighted_value'],
        [sequelize.fn('COUNT', sequelize.col('Deal.id')), 'deal_count'],
        [sequelize.fn('AVG', sequelize.col('Deal.probability')), 'avg_probability'],
      ],
      include: [
        {
          model: PipelineStage,
          as: 'stage',
          attributes: ['id', 'name', 'color', 'position', 'probability'],
        },
      ],
      group: ['stage_id', 'stage.id', 'stage.name', 'stage.color', 'stage.position', 'stage.probability'],
      order: [[{ model: PipelineStage, as: 'stage' }, 'position', 'ASC']],
      raw: true,
      nest: true,
    });

    return results.map((r) => ({
      stage_id: r.stage_id,
      name: r.stage?.name || 'Unknown',
      color: r.stage?.color || '#0072BC',
      position: r.stage?.position || 0,
      total_value: parseFloat(r.total_value) || 0,
      weighted_value: parseFloat(r.weighted_value) || 0,
      deal_count: parseInt(r.deal_count) || 0,
      avg_probability: parseFloat(r.avg_probability) || 0,
    }));
  }

  /**
   * Get forecast vs actual comparison for past months
   */
  async getVsActual(filters = {}) {
    const months = parseInt(filters.months) || 6;
    const now = new Date();

    const pipelineFilter = filters.pipeline_id ? ` AND pipeline_id = ${parseInt(filters.pipeline_id)}` : '';
    const ownerFilter = filters.owner_id ? ` AND owner_id = ${parseInt(filters.owner_id)}` : '';
    const extraFilters = pipelineFilter + ownerFilter;

    // Forecasted: deals with expected_close_date in each past month (open + won + lost)
    const forecasted = await sequelize.query(
      `SELECT DATE_FORMAT(expected_close_date, '%Y-%m') AS month,
        SUM(value) AS forecasted_value,
        COUNT(*) AS forecasted_count
       FROM deals
       WHERE expected_close_date IS NOT NULL AND deleted_at IS NULL${extraFilters}
         AND expected_close_date >= DATE_SUB(CURDATE(), INTERVAL ${months} MONTH)
         AND expected_close_date < CURDATE()
       GROUP BY month ORDER BY month`,
      { type: sequelize.QueryTypes.SELECT }
    );

    // Actual: won deals with actual_close_date in each past month
    const actual = await sequelize.query(
      `SELECT DATE_FORMAT(actual_close_date, '%Y-%m') AS month,
        SUM(value) AS actual_value,
        COUNT(*) AS actual_count
       FROM deals
       WHERE status = 'won' AND actual_close_date IS NOT NULL AND deleted_at IS NULL${extraFilters}
         AND actual_close_date >= DATE_SUB(CURDATE(), INTERVAL ${months} MONTH)
         AND actual_close_date < CURDATE()
       GROUP BY month ORDER BY month`,
      { type: sequelize.QueryTypes.SELECT }
    );

    // Merge and fill gaps
    const data = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const f = forecasted.find((r) => r.month === monthKey);
      const a = actual.find((r) => r.month === monthKey);
      data.push({
        month: monthKey,
        label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        forecasted_value: f ? parseFloat(f.forecasted_value) : 0,
        actual_value: a ? parseFloat(a.actual_value) : 0,
      });
    }

    return data;
  }
}

module.exports = new ForecastService();
