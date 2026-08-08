import { sanitizeSqlParams } from './sql.helper.js';

describe('sanitizeSqlParams', () => {
  it('replaces string literals with ?', () => {
    const sql = "select * from users where name = 'John'";
    expect(sanitizeSqlParams(sql)).toBe('select * from users where name = ?');
  });

  it('replaces NULL values', () => {
    const sql = 'insert into users (name, age) values (NULL, NULL)';
    expect(sanitizeSqlParams(sql)).toBe(
      'insert into users (name, age) values (?, ?)',
    );
  });

  it('replaces boolean values', () => {
    const sql = 'update users set active = true where deleted = false';
    expect(sanitizeSqlParams(sql)).toBe(
      'update users set active = ? where deleted = ?',
    );
  });

  it('replaces numeric values', () => {
    const sql = 'select * from products where price > 100 and rating = 4.5';
    expect(sanitizeSqlParams(sql)).toBe(
      'select * from products where price > ? and rating = ?',
    );
  });

  it('does not modify column or table names', () => {
    const sql = 'select "user_id", "created_at" from "users"';
    expect(sanitizeSqlParams(sql)).toBe(sql);
  });

  it('sanitizes complex INSERT statement', () => {
    const sql = `
      insert into "resumes" ("id", "user_id", "name", "is_default")
      values (
        '019c9b37-96e3-71d1-88ea-f39000a6f366',
        '019c9b37-d1df-710e-a5d0-2ade4d2273fd',
        'New Resume_1',
        false
      )
    `;

    const expected = `
      insert into "resumes" ("id", "user_id", "name", "is_default")
      values (
        ?,
        ?,
        ?,
        ?
      )
    `;

    expect(sanitizeSqlParams(sql)).toBe(expected);
  });

  it('handles escaped single quotes inside string', () => {
    const sql = "select * from users where name = 'O''Connor'";
    expect(sanitizeSqlParams(sql)).toBe('select * from users where name = ?');
  });

  it('is case insensitive for NULL and booleans', () => {
    const sql = 'insert into test values (Null, TRUE, False)';
    expect(sanitizeSqlParams(sql)).toBe('insert into test values (?, ?, ?)');
  });

  it('replaces values inside IN clause', () => {
    const sql = 'select * from users where id in (1, 2, 3)';
    expect(sanitizeSqlParams(sql)).toBe(
      'select * from users where id in (?, ?, ?)',
    );
  });

  it('does not touch JSON content inside string', () => {
    const sql = `insert into logs (payload) values ('{"count":10,"active":true}')`;
    expect(sanitizeSqlParams(sql)).toBe(
      'insert into logs (payload) values (?)',
    );
  });

  it('replaces dates in strings', () => {
    const sql = "where created_at > '2026-02-26 18:30:37.539'";
    expect(sanitizeSqlParams(sql)).toBe('where created_at > ?');
  });

  it('handles nested conditions', () => {
    const sql = `
      select * from users
      where (age > 18 and active = true)
        or (created_at < '2020-01-01')
    `;

    const expected = `
      select * from users
      where (age > ? and active = ?)
        or (created_at < ?)
    `;

    expect(sanitizeSqlParams(sql)).toBe(expected);
  });

  it('handles multiple SQL statements', () => {
    const sql = `
      update users set name = 'John' where id = 1;
      delete from users where active = false;
    `;

    const expected = `
      update users set name = ? where id = ?;
      delete from users where active = ?;
    `;

    expect(sanitizeSqlParams(sql)).toBe(expected);
  });

  it('handles subqueries', () => {
    const sql = `
      select * from users
      where id in (select user_id from orders where total > 100)
    `;

    const expected = `
      select * from users
      where id in (select user_id from orders where total > ?)
    `;

    expect(sanitizeSqlParams(sql)).toBe(expected);
  });

  it('handles CASE expressions', () => {
    const sql = `
      select
        case when score > 90 then 'A'
             when score > 75 then 'B'
             else 'C'
        end
      from exams
    `;

    const expected = `
      select
        case when score > ? then ?
             when score > ? then ?
             else ?
        end
      from exams
    `;

    expect(sanitizeSqlParams(sql)).toBe(expected);
  });

  it('handles BETWEEN operator', () => {
    const sql = 'select * from orders where price between 10 and 100';
    expect(sanitizeSqlParams(sql)).toBe(
      'select * from orders where price between ? and ?',
    );
  });

  it('handles EXISTS clause', () => {
    const sql = `
      select * from users u
      where exists (
        select 1 from sessions s where s.user_id = u.id and s.active = true
      )
    `;

    const expected = `
      select * from users u
      where exists (
        select ? from sessions s where s.user_id = u.id and s.active = ?
      )
    `;

    expect(sanitizeSqlParams(sql)).toBe(expected);
  });

  it('is case insensitive everywhere', () => {
    const sql = 'SeLeCt * FrOm users WhErE active = TRUE and deleted = Null';
    expect(sanitizeSqlParams(sql)).toBe(
      'SeLeCt * FrOm users WhErE active = ? and deleted = ?',
    );
  });

  it('does not replace SQL functions', () => {
    const sql = 'insert into users (id) values (uuid_generate_v4())';
    expect(sanitizeSqlParams(sql)).toBe(sql);
  });

  it('does not replace numbers inside identifiers', () => {
    const sql = 'select "column_123" from "table_2026"';
    expect(sanitizeSqlParams(sql)).toBe(sql);
  });

  it('handles update with multiple fields', () => {
    const sql = `
      update users
      set name = 'Alice',
          age = 30,
          active = false
      where id = 999
    `;

    const expected = `
      update users
      set name = ?,
          age = ?,
          active = ?
      where id = ?
    `;

    expect(sanitizeSqlParams(sql)).toBe(expected);
  });

  it('handles empty string literal', () => {
    const sql = "insert into test (value) values ('')";
    expect(sanitizeSqlParams(sql)).toBe('insert into test (value) values (?)');
  });

  it('handles escaped quotes correctly', () => {
    const sql = "insert into test (value) values ('It''s fine')";
    expect(sanitizeSqlParams(sql)).toBe('insert into test (value) values (?)');
  });

  it('replaces JSON string values correctly', () => {
    const sql = `
    insert into logs (id, payload, created_at) values (
      1,
      '{"user":{"id":123,"name":"Alice"},"active":true}',
      '2026-02-26T18:30:37Z'
    )
  `;

    const expected = `
    insert into logs (id, payload, created_at) values (
      ?,
      ?,
      ?
    )
  `;

    expect(sanitizeSqlParams(sql)).toBe(expected);
  });
});
